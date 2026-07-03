#!/usr/bin/env node

require('dotenv').config();

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { 
  CallToolRequestSchema, 
  ListToolsRequestSchema 
} = require('@modelcontextprotocol/sdk/types.js');

const { exec, execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const ini = require('ini');
const { Writable } = require('stream');
const os = require('os');
const { https } = require('follow-redirects');
const http = require('http');
const pkg = require('./package.json');

process.stdout.setMaxListeners(0);

const MCP_TRANSPORT = process.env.MCP_TRANSPORT || 'stdio';

// Server configuration
const SERVER_INFO = {
  name: 'defold-mcp',
  version: pkg.version,
  description: 'MCP server for the Defold game engine'
};

// Tools with a real handler in callTool(). Everything else in TOOLS is
// declared but not yet implemented, so it is hidden from tools/list and
// rejected with a clear message rather than throwing a TypeError.
const IMPLEMENTED_TOOLS = new Set([
  'launch_defold',
  'run_project',
  'create_project',
  'list_projects',
  'get_project_settings',
  'engine_info',
  'run_script',
  'hot_reload',
  'screenshot_game'
]);

// Defold's built-in engine service (debug builds only). Defaults to port 8001,
// but when the game is launched from the editor DM_SERVICE_PORT is "dynamic"
// (OS-assigned), so callers may need to pass an explicit port.
const ENGINE_SERVICE_HOST = process.env.DM_SERVICE_HOST || '127.0.0.1';
const ENGINE_SERVICE_PORT_DEFAULT = 8001;

// --- Minimal protobuf wire-format encoding (no dependency) ---
// Only length-delimited (wire type 2) fields with single-byte tags (field
// numbers < 16) are needed for the engine service messages below.
function encodeVarint(value) {
  const bytes = [];
  let n = value;
  while (n > 0x7f) {
    bytes.push((n & 0x7f) | 0x80);
    n = Math.floor(n / 128);
  }
  bytes.push(n);
  return Buffer.from(bytes);
}

function lenDelimited(fieldNumber, payload) {
  const tag = Buffer.from([(fieldNumber << 3) | 2]);
  return Buffer.concat([tag, encodeVarint(payload.length), payload]);
}

// Define the tools the server provides
const TOOLS = [
  {
    name: 'launch_defold',
    description: 'Launch Defold editor for a project',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' }
    }
  },
  {
    name: 'run_project',
    description: 'Run Defold project in debug mode and capture console output',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' }
    }
  },
  {
    name: 'create_project',
    description: 'Create a new Defold project with basic structure',
    parameters: {
      projectPath: { type: 'string', description: 'Path for new project directory' },
      projectName: { type: 'string', description: 'Name of the project' }
    }
  },
  {
    name: 'list_projects',
    description: 'List all Defold projects in a directory',
    parameters: {
      directory: { type: 'string', description: 'Directory to search for Defold projects' }
    }
  },
  {
    name: 'get_project_settings',
    description: 'Read settings from game.project file',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' }
    }
  },
  {
    name: 'update_project_settings',
    description: 'Update settings in game.project file',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      settings: { type: 'object', description: 'Key-value pairs to update (e.g., { project: { title: "New Title" } })' }
    }
  },
  {
    name: 'create_script',
    description: 'Create a new Lua script in the Defold project',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      scriptName: { type: 'string', description: 'Name of the script (without .lua)' },
      scriptType: { type: 'string', description: 'Type: script, gui_script, render_script', default: 'script' },
      content: { type: 'string', description: 'Script content', default: '-- Lua script created by Defold MCP\n' }
    }
  },
  {
    name: 'edit_script',
    description: 'Edit an existing Lua script in the Defold project',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      scriptName: { type: 'string', description: 'Name of the script (without .lua)' },
      content: { type: 'string', description: 'New script content' }
    }
  },
  {
    name: 'create_lua_module',
    description: 'Create a reusable Lua module',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      moduleName: { type: 'string', description: 'Name of the module (without .lua)' },
      content: { type: 'string', description: 'Module content', default: 'local M = {}\nreturn M\n' }
    }
  },
  {
    name: 'create_collection',
    description: 'Create a new collection in the Defold project',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' }
    }
  },
  {
    name: 'add_game_object',
    description: 'Add a game object to a collection',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' },
      objectName: { type: 'string', description: 'Name of the game object' },
      position: { type: 'object', description: 'Position {x, y, z}', default: { x: 0, y: 0, z: 0 } }
    }
  },
  {
    name: 'add_component',
    description: 'Add a component (e.g., sprite, script) to a game object',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' },
      objectName: { type: 'string', description: 'Name of the game object' },
      componentType: { type: 'string', description: 'Type: sprite, script, collisionobject, etc.' },
      componentPath: { type: 'string', description: 'Path to component resource (e.g., /main/player.script)' }
    }
  },
  {
    name: 'create_sprite',
    description: 'Create a sprite asset and add it to a collection',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' },
      spriteName: { type: 'string', description: 'Name of the sprite' },
      imagePath: { type: 'string', description: 'Path to image file (e.g., /assets/player.png)' }
    }
  },
  {
    name: 'create_tilemap',
    description: 'Create a tilemap asset and add it to a collection',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' },
      tilemapName: { type: 'string', description: 'Name of the tilemap' },
      tilesourcePath: { type: 'string', description: 'Path to tilesource file (e.g., /assets/tiles.tilesource)' }
    }
  },
  {
    name: 'create_particlefx',
    description: 'Create a particle effect and add it to a collection',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' },
      particleName: { type: 'string', description: 'Name of the particle effect' },
      emitterConfig: { type: 'object', description: 'Emitter configuration (e.g., { size: 1, life: 2 })', default: {} }
    }
  },
  {
    name: 'create_sound',
    description: 'Create a sound component and add it to a collection',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' },
      soundName: { type: 'string', description: 'Name of the sound' },
      soundFile: { type: 'string', description: 'Path to sound file (e.g., /assets/sound.wav)' }
    }
  },
  {
    name: 'create_camera',
    description: 'Create a camera component and add it to a collection',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' },
      cameraName: { type: 'string', description: 'Name of the camera' },
      properties: { type: 'object', description: 'Camera properties (e.g., { fov: 45, near_z: 0.1 })', default: {} }
    }
  },
  {
    name: 'create_factory',
    description: 'Create a factory component for spawning game objects',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' },
      factoryName: { type: 'string', description: 'Name of the factory' },
      prototypePath: { type: 'string', description: 'Path to prototype (e.g., /main/enemy.collection)' }
    }
  },
  {
    name: 'create_gui',
    description: 'Create a GUI scene and script',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      guiName: { type: 'string', description: 'Name of the GUI (without .gui)' },
      scriptContent: { type: 'string', description: 'GUI script content', default: '-- GUI script created by Defold MCP\n' }
    }
  },
  {
    name: 'setup_physics',
    description: 'Configure physics for a collision object in a collection',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      collectionName: { type: 'string', description: 'Name of the collection (without .collection)' },
      objectName: { type: 'string', description: 'Name of the game object' },
      collisionType: { type: 'string', description: 'Type: dynamic, static, kinematic', default: 'dynamic' },
      shapeType: { type: 'string', description: 'Shape: box, sphere, capsule', default: 'box' }
    }
  },
  {
    name: 'configure_render',
    description: 'Configure render settings in render.render',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      renderSettings: { type: 'object', description: 'Render settings (e.g., { clear_color: { r: 0, g: 0, b: 0, a: 1 } })' }
    }
  },
  {
    name: 'setup_bob',
    description: 'Locate, configure, or download bob.jar for build operations',
    parameters: {
      defoldPath: { type: 'string', description: 'Path to Defold installation (optional)', default: '', optional: true },
      bobPath: { type: 'string', description: 'Custom path to bob.jar (optional)', default: '', optional: true },
      defoldVersion: { type: 'string', description: 'Defold version for downloading bob.jar (e.g., 1.9.6)', default: '', optional: true }
    }
  },
  {
    name: 'build_project',
    description: 'Build Defold project for a target platform',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      platform: { type: 'string', description: 'Target platform: html5, ios, android, win32, osx, linux' },
      variant: { type: 'string', description: 'Build variant: debug, release', default: 'debug' }
    }
  },
  {
    name: 'bundle_project',
    description: 'Bundle Defold project for distribution',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      platform: { type: 'string', description: 'Target platform: ios, android' },
      outputDir: { type: 'string', description: 'Output directory for bundled files' }
    }
  },
  {
    name: 'debug_logs',
    description: 'Capture and analyze Defold debug logs',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' }
    }
  },
  {
    name: 'stream_logs',
    description: 'Stream real-time debug logs from a running Defold project',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' }
    }
  },
  {
    name: 'enable_hot_reload',
    description: 'Enable hot-reload by watching project files',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' }
    }
  },
  {
    name: 'add_native_extension',
    description: 'Add a native extension to the project',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' },
      extensionUrl: { type: 'string', description: 'URL to extension repository or zip file' }
    }
  },
  {
    name: 'get_project_analytics',
    description: 'Retrieve analytics on project modifications',
    parameters: {
      projectPath: { type: 'string', description: 'Path to Defold project directory' }
    }
  },
  {
    name: 'engine_info',
    description: 'Query the running Defold game via its built-in engine service (debug builds only). GET /info returns engine version, platform, sha1, and log_port. Doubles as a health check / port-confirmation. Default port 8001; when the game is launched from the editor DM_SERVICE_PORT is "dynamic", so pass the actual port if 8001 fails.',
    parameters: {
      host: { type: 'string', description: 'Engine service host (default 127.0.0.1)', default: '127.0.0.1', optional: true },
      port: { type: 'number', description: 'Engine service port (default 8001, or DM_SERVICE_PORT if numeric)', default: 8001, optional: true },
      timeoutMs: { type: 'number', description: 'Request timeout in ms (default 2000)', default: 2000, optional: true }
    }
  },
  {
    name: 'run_script',
    description: 'Run arbitrary Lua in the running Defold game via the built-in engine service (debug builds only). POSTs a RunScript message to /post/@system/run_script. This is the engine-native way to trigger any game action, e.g. call a menu function or post an input action to "click" a button. Pair with screenshot_game for visual verification.',
    parameters: {
      script: { type: 'string', description: 'Lua source to execute in the game, e.g. \'require("main.menu").start()\'' },
      filename: { type: 'string', description: 'Chunk name shown in error messages', default: 'mcp_run_script.lua', optional: true },
      host: { type: 'string', description: 'Engine service host (default 127.0.0.1)', default: '127.0.0.1', optional: true },
      port: { type: 'number', description: 'Engine service port (default 8001, or DM_SERVICE_PORT if numeric)', default: 8001, optional: true },
      timeoutMs: { type: 'number', description: 'Request timeout in ms (default 5000)', default: 5000, optional: true }
    }
  },
  {
    name: 'hot_reload',
    description: 'Hot-reload one or more resources in the running Defold game via the built-in engine service (debug builds only). POSTs a Reload message to /post/@resource/reload. Provide compiled resource paths, e.g. "/main/level.collectionc" or "/main/player.scriptc".',
    parameters: {
      resources: { type: 'string', description: 'Comma-separated resource path(s) to reload, e.g. "/main/player.scriptc,/main/level.collectionc"' },
      host: { type: 'string', description: 'Engine service host (default 127.0.0.1)', default: '127.0.0.1', optional: true },
      port: { type: 'number', description: 'Engine service port (default 8001, or DM_SERVICE_PORT if numeric)', default: 8001, optional: true },
      timeoutMs: { type: 'number', description: 'Request timeout in ms (default 2000)', default: 2000, optional: true }
    }
  },
  {
    name: 'screenshot_game',
    description: 'Capture a screenshot of the running Defold game window for visual verification. Returns a base64 PNG image content block. Pair with run_script to verify button presses.',
    parameters: {
      windowTitle: { type: 'string', description: 'Substring of the game window title to target (default "defold"). Case-insensitive.', default: 'defold', optional: true },
      outputPath: { type: 'string', description: 'Optional path to also save the PNG to disk.', optional: true }
    }
  }
];

const DEFOLD_PATH = process.env.DEFOLD_PATH || (process.platform === 'win32'
  ? 'C:\\Program Files\\Defold\\Defold.exe'
  : '/Applications/Defold.app/Contents/MacOS/Defold');
let BOB_PATH = process.env.BOB_PATH || null;
const BOB_DOWNLOAD_URL = 'https://github.com/defold/defold/releases/download';

class DefoldMCPServer {
  constructor() {
    this.logStreams = new Map();
    this.watchers = new Map();
    this.analytics = new Map();
    this.bobInitialized = false;
    
    // Create the MCP server
    this.server = new Server(
      SERVER_INFO,
      {
        capabilities: {
          tools: { listChanged: false }
        }
      }
    );
    
    // Set up request handlers for the standard MCP protocol endpoints
    this.setupRequestHandlers();
  }
  
  setupRequestHandlers() {
    // Handle tools/list
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: TOOLS.filter(tool => IMPLEMENTED_TOOLS.has(tool.name)).map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: {
            type: 'object',
            properties: Object.fromEntries(
              Object.entries(tool.parameters || {}).map(([key, param]) => {
                const schema = { type: param.type, description: param.description };
                if (param.default !== undefined) schema.default = param.default;
                return [key, schema];
              })
            ),
            // A param is required only when it is neither marked optional nor
            // carries a default value.
            required: Object.entries(tool.parameters || {})
              .filter(([_, param]) => !param.optional && param.default === undefined)
              .map(([key, _]) => key)
          }
        }))
      };
    });
    
    // Handle tools/call
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;

        if (TOOLS.some(t => t.name === name) && !IMPLEMENTED_TOOLS.has(name)) {
          return {
            content: [{ type: 'text', text: `Tool "${name}" is declared but not yet implemented.` }],
            isError: true
          };
        }

        if (['build_project', 'bundle_project', 'add_native_extension', 'setup_bob'].includes(name)) {
          await this.ensureBobInitialized();
        }
        
        // Call the appropriate tool handler
        const result = await this.callTool(name, args);
        return {
          content: result.content
        };
      } catch (error) {
        console.error(`Error handling tools/call: ${error.message}`);
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    });
  }
  
  async callTool(name, args) {
    switch (name) {
      case 'launch_defold':
        return await this.launchDefold(args.projectPath);
      case 'run_project':
        return await this.runProject(args.projectPath);
      case 'create_project':
        return await this.createProject(args.projectPath, args.projectName);
      case 'list_projects':
        return await this.listProjects(args.directory);
      case 'get_project_settings':
        return await this.getProjectSettings(args.projectPath);
      case 'update_project_settings':
        return await this.updateProjectSettings(args.projectPath, args.settings);
      case 'create_script':
        return await this.createScript(args.projectPath, args.scriptName, args.scriptType, args.content);
      case 'edit_script':
        return await this.editScript(args.projectPath, args.scriptName, args.content);
      case 'create_lua_module':
        return await this.createLuaModule(args.projectPath, args.moduleName, args.content);
      case 'create_collection':
        return await this.createCollection(args.projectPath, args.collectionName);
      case 'add_game_object':
        return await this.addGameObject(args.projectPath, args.collectionName, args.objectName, args.position);
      case 'add_component':
        return await this.addComponent(args.projectPath, args.collectionName, args.objectName, args.componentType, args.componentPath);
      case 'create_sprite':
        return await this.createSprite(args.projectPath, args.collectionName, args.spriteName, args.imagePath);
      case 'create_tilemap':
        return await this.createTilemap(args.projectPath, args.collectionName, args.tilemapName, args.tilesourcePath);
      case 'create_particlefx':
        return await this.createParticlefx(args.projectPath, args.collectionName, args.particleName, args.emitterConfig);
      case 'create_sound':
        return await this.createSound(args.projectPath, args.collectionName, args.soundName, args.soundFile);
      case 'create_camera':
        return await this.createCamera(args.projectPath, args.collectionName, args.cameraName, args.properties);
      case 'create_factory':
        return await this.createFactory(args.projectPath, args.collectionName, args.factoryName, args.prototypePath);
      case 'create_gui':
        return await this.createGui(args.projectPath, args.guiName, args.scriptContent);
      case 'setup_physics':
        return await this.setupPhysics(args.projectPath, args.collectionName, args.objectName, args.collisionType, args.shapeType);
      case 'configure_render':
        return await this.configureRender(args.projectPath, args.renderSettings);
      case 'setup_bob':
        return await this.setupBob(args.defoldPath, args.bobPath, args.defoldVersion);
      case 'build_project':
        return await this.buildProject(args.projectPath, args.platform, args.variant);
      case 'bundle_project':
        return await this.bundleProject(args.projectPath, args.platform, args.outputDir);
      case 'debug_logs':
        return await this.debugLogs(args.projectPath);
      case 'stream_logs':
        return await this.streamLogs(args.projectPath);
      case 'enable_hot_reload':
        return await this.enableHotReload(args.projectPath);
      case 'add_native_extension':
        return await this.addNativeExtension(args.projectPath, args.extensionUrl);
      case 'get_project_analytics':
        return await this.getProjectAnalytics(args.projectPath);
      case 'engine_info':
        return await this.engineInfo(args.host, args.port, args.timeoutMs);
      case 'run_script':
        return await this.runScript(args.script, args.filename, args.host, args.port, args.timeoutMs);
      case 'hot_reload':
        return await this.hotReload(args.resources, args.host, args.port, args.timeoutMs);
      case 'screenshot_game':
        return await this.screenshotGame(args.windowTitle, args.outputPath);
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }
  
  async start() {
    if (MCP_TRANSPORT === 'stdio') {
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
    } else {
      throw new Error('WebSocket transport not yet implemented with MCP SDK');
    }
  }
  
  async ensureBobInitialized() {
    if (!this.bobInitialized) {
      await this.initializeBobPath();
      this.bobInitialized = true;
    }
  }

  async initializeBobPath() {
    if (BOB_PATH) return;
    const possiblePaths = [
      path.join(path.dirname(DEFOLD_PATH), 'Contents', 'Resources', 'bob.jar'),
      path.join(path.dirname(DEFOLD_PATH), 'Resources', 'bob.jar'),
      path.join(os.homedir(), 'defold', 'bob.jar'),
      '/usr/local/bin/bob.jar'
    ];
    for (const p of possiblePaths) {
      try {
        await fs.access(p);
        if (await this.validateBobJar(p)) {
          BOB_PATH = p;
          return;
        }
      } catch {}
    }
    console.warn('bob.jar not found. Use setup_bob tool with defoldVersion (e.g., 1.9.6) to download from GitHub.');
  }

  async validateBobJar(bobPath) {
    try {
      const output = execSync(`java -jar "${bobPath}" --version`, { encoding: 'utf8' });
      if (!output.includes('bob.jar')) {
        throw new Error('Invalid bob.jar');
      }
      const javaVersion = execSync('java -version 2>&1', { encoding: 'utf8' });
      if (!javaVersion.includes('21.')) {
        throw new Error('OpenJDK 21 required. Install with: brew install openjdk@21');
      }
      return true;
    } catch (error) {
      console.warn(`bob.jar validation failed at ${bobPath}: ${error.message}`);
      return false;
    }
  }

  async downloadBobJar(version, targetPath) {
    const url = `${BOB_DOWNLOAD_URL}/${version}/bob.jar`;
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    return new Promise((resolve, reject) => {
      const fileStream = require('fs').createWriteStream(targetPath);
      const request = https.get(url, (res) => {
        if (res.statusCode !== 200) {
          fileStream.close();
          reject(new Error(`Failed to download bob.jar: HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
      }).on('error', (error) => {
        fileStream.close();
        reject(error);
      });
      request.end();
    });
  }

  // Implement all the tool handlers here
  async launchDefold(projectPath) {
    try {
      let resolvedPath = path.resolve(projectPath);
      
      // Ensure the path ends with game.project
      if (!resolvedPath.endsWith('game.project')) {
        // Check if it's a directory
        const stats = await fs.stat(resolvedPath);
        if (stats.isDirectory()) {
          resolvedPath = path.join(resolvedPath, 'game.project');
        } else {
          // Not a directory and doesn't end with game.project
          throw new Error('Project path must be either a directory or a path to game.project file');
        }
      }
      
      // Verify the game.project file exists
      try {
        await fs.access(resolvedPath);
      } catch (accessError) {
        throw new Error(`Cannot find game.project at: ${resolvedPath}`);
      }
      
      const cmd = `"${DEFOLD_PATH}" "${resolvedPath}"`;
      exec(cmd, (error, stdout, stderr) => {
        if (error) console.error(`Error launching Defold: ${error.message}`);
      });
      return { content: [{ type: 'text', text: `Defold editor launched` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }

  async runProject(projectPath) {
    try {
      const cmd = `"${DEFOLD_PATH}" --config debug=true "${path.resolve(projectPath)}"`;
      const child = spawn(cmd, { shell: true, stdio: 'pipe' });
      const logStream = new Writable({
        write(chunk, encoding, callback) {
          console.error(chunk.toString());
          callback();
        }
      });
      child.stdout.pipe(logStream);
      child.stderr.pipe(logStream);
      this.logStreams.set(projectPath, child);
      return { content: [{ type: 'text', text: 'Project running with debug output' }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }

  async createProject(projectPath, projectName) {
    try {
      const dir = path.resolve(projectPath);
      await fs.mkdir(dir, { recursive: true });
      const gameProjectContent = `[project]
title = ${projectName}
dependencies = 
version = 1.0
`;
      await fs.writeFile(path.join(dir, 'game.project'), gameProjectContent);
      await fs.mkdir(path.join(dir, 'main'));
      await fs.writeFile(path.join(dir, 'main/main.collection'), '');
      return { content: [{ type: 'text', text: `Project ${projectName} created at ${dir}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }

  async listProjects(directory) {
    try {
      const dir = path.resolve(directory);
      const files = await fs.readdir(dir, { withFileTypes: true });
      const projects = [];
      for (const file of files) {
        if (file.isDirectory()) {
          const projectFile = path.join(dir, file.name, 'game.project');
          try {
            await fs.access(projectFile);
            projects.push(file.name);
          } catch {}
        }
      }
      return { content: [{ type: 'text', text: `Found ${projects.length} projects:\n${projects.join('\n')}` }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }

  // Add the rest of your tool implementations here
  // Each method should return { content: [{ type: 'text', text: 'result' }] }
  // For errors, return { content: [{ type: 'text', text: 'Error message' }], isError: true }
  
  // For example:
  async getProjectSettings(projectPath) {
    try {
      const projectFile = path.join(path.resolve(projectPath), 'game.project');
      const content = await fs.readFile(projectFile, 'utf8');
      const settings = ini.parse(content);
      return { content: [{ type: 'text', text: JSON.stringify(settings, null, 2) }] };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }
  
  // --- Defold built-in engine service (debug builds) ---

  resolveServicePort(port) {
    if (port) return port;
    const env = process.env.DM_SERVICE_PORT;
    if (env && /^\d+$/.test(env)) return parseInt(env, 10);
    return ENGINE_SERVICE_PORT_DEFAULT;
  }

  httpRequest(method, { host, port, path: reqPath, body, timeoutMs }) {
    return new Promise((resolve, reject) => {
      const headers = {};
      if (body) {
        headers['Content-Type'] = 'application/octet-stream';
        headers['Content-Length'] = body.length;
      }
      const req = http.request({ host, port, path: reqPath, method, headers }, (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy(new Error(`request timed out after ${timeoutMs}ms`));
      });
      if (body) req.write(body);
      req.end();
    });
  }

  engineServiceError(error) {
    const hint = error.code === 'ECONNREFUSED'
      ? '\nHint: engine service not reachable. It is only present in DEBUG builds (not release bundles). When the game is launched from the editor, DM_SERVICE_PORT is "dynamic" (a random OS-assigned port) — pass the actual port, or launch with DM_SERVICE_PORT=8001 to pin it. Use engine_info to confirm.'
      : '';
    return { content: [{ type: 'text', text: `Error: ${error.message}${hint}` }], isError: true };
  }

  async engineInfo(host, port, timeoutMs) {
    const targetHost = host || ENGINE_SERVICE_HOST;
    const targetPort = this.resolveServicePort(port);
    try {
      const { status, body } = await this.httpRequest('GET', {
        host: targetHost, port: targetPort, path: '/info', timeoutMs: timeoutMs || 2000
      });
      const text = `GET http://${targetHost}:${targetPort}/info\nHTTP ${status}\n${body}`;
      return { content: [{ type: 'text', text }], isError: status >= 400 };
    } catch (error) {
      return this.engineServiceError(error);
    }
  }

  async runScript(script, filename, host, port, timeoutMs) {
    const targetHost = host || ENGINE_SERVICE_HOST;
    const targetPort = this.resolveServicePort(port);
    try {
      if (!script || typeof script !== 'string') {
        throw new Error('script (Lua source) is required');
      }
      // RunScript { module(1): LuaModule { source(1): LuaSource { script(1) bytes, filename(2) string } } }
      const luaSource = Buffer.concat([
        lenDelimited(1, Buffer.from(script, 'utf8')),
        lenDelimited(2, Buffer.from(filename || 'mcp_run_script.lua', 'utf8'))
      ]);
      const body = lenDelimited(1, lenDelimited(1, luaSource));
      const { status, body: resBody } = await this.httpRequest('POST', {
        host: targetHost, port: targetPort, path: '/post/@system/run_script',
        body, timeoutMs: timeoutMs || 5000
      });
      const text = `POST http://${targetHost}:${targetPort}/post/@system/run_script (${script.length} chars of Lua)\nHTTP ${status}\n${resBody}`;
      return { content: [{ type: 'text', text }], isError: status >= 400 };
    } catch (error) {
      return this.engineServiceError(error);
    }
  }

  async hotReload(resources, host, port, timeoutMs) {
    const targetHost = host || ENGINE_SERVICE_HOST;
    const targetPort = this.resolveServicePort(port);
    try {
      let list = resources;
      if (typeof list === 'string') {
        list = list.split(',').map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(list) || list.length === 0) {
        throw new Error('resources is required (comma-separated resource paths, e.g. "/main/player.scriptc")');
      }
      // Reload { resources(1): repeated string }
      const body = Buffer.concat(list.map((r) => lenDelimited(1, Buffer.from(r, 'utf8'))));
      const { status, body: resBody } = await this.httpRequest('POST', {
        host: targetHost, port: targetPort, path: '/post/@resource/reload',
        body, timeoutMs: timeoutMs || 2000
      });
      const text = `POST http://${targetHost}:${targetPort}/post/@resource/reload\nresources: ${list.join(', ')}\nHTTP ${status}\n${resBody}`;
      return { content: [{ type: 'text', text }], isError: status >= 400 };
    } catch (error) {
      return this.engineServiceError(error);
    }
  }

  async screenshotGame(windowTitle, outputPath) {
    try {
      const title = (windowTitle || 'defold').toString();
      const platform = process.platform;
      // Sanitize outputPath: only allow filesystem-safe characters.
      let pngPath = outputPath || path.join(os.tmpdir(), `defold-mcp-screenshot-${Date.now()}.png`);
      pngPath = path.resolve(pngPath);
      // The path is passed as a quoted argument to the shell/PowerShell, so the
      // only real risk is a character that can break out of the quoting.
      // Reject those (and control chars); allow spaces and normal path chars.
      if (/["'`$\r\n]/.test(pngPath)) {
        throw new Error('outputPath contains invalid characters');
      }

      if (platform === 'win32') {
        await this.screenshotWin32(title, pngPath);
      } else if (platform === 'darwin') {
        // macOS: use screencapture for full screen.
        execSync(`screencapture -x ${this.shellQuote(pngPath)}`);
      } else {
        // Linux: try import (ImageMagick), fall back to scrot.
        try {
          execSync(`import -window root ${this.shellQuote(pngPath)}`);
        } catch {
          execSync(`scrot ${this.shellQuote(pngPath)}`);
        }
      }

      const data = await fs.readFile(pngPath);
      const base64 = data.toString('base64');
      const content = [
        { type: 'image', data: base64, mimeType: 'image/png' },
        { type: 'text', text: `Screenshot saved to ${pngPath}` }
      ];
      return { content };
    } catch (error) {
      return { content: [{ type: 'text', text: `Error: ${error.message}` }], isError: true };
    }
  }

  shellQuote(s) {
    // Single-quote for POSIX shells; escape embedded single quotes.
    return "'" + String(s).replace(/'/g, "'\\''") + "'";
  }

  async screenshotWin32(title, pngPath) {
    // Static PowerShell script — NO user input is interpolated into the script body.
    // User-supplied title and pngPath are passed as PowerShell arguments (params).
    const psScript = `param([string]$WinTitle, [string]$OutPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
}
"@
$hwnd = [IntPtr]::Zero
$gameProcs = Get-Process -Name 'dmengine','Dmengine' -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 }
if ($gameProcs) { $hwnd = $gameProcs[0].MainWindowHandle }
if ($hwnd -eq [IntPtr]::Zero -and $WinTitle) {
  $procs = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle.ToLower().Contains($WinTitle.ToLower()) }
  if ($procs) { $hwnd = $procs[0].MainWindowHandle }
}
if ($hwnd -eq [IntPtr]::Zero) {
  throw "No matching game window found"
}
[void][W]::ShowWindow($hwnd, 9)
Start-Sleep -Milliseconds 300
[void][W]::SetForegroundWindow($hwnd)
Start-Sleep -Milliseconds 800
$r = New-Object W+RECT
[void][W]::GetClientRect($hwnd, [ref]$r)
$pt = New-Object W+POINT
[void][W]::ClientToScreen($hwnd, [ref]$pt)
$w = $r.Right - $r.Left
$ht = $r.Bottom - $r.Top
if ($w -le 0 -or $ht -le 0) { throw "window rect invalid" }
$bmp = New-Object System.Drawing.Bitmap $w, $ht
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($pt.X, $pt.Y, 0, 0, $bmp.Size)
$g.Dispose()
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
`;
    const tmpScript = path.join(os.tmpdir(), `defold-mcp-screenshot-${Date.now()}.ps1`);
    await fs.writeFile(tmpScript, psScript, 'utf8');
    try {
      // Pass user input as PowerShell params — no string interpolation into the script.
      execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}" -WinTitle "${title.replace(/["`$]/g, '')}" -OutPath "${pngPath}"`,
        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
      );
    } finally {
      await fs.unlink(tmpScript).catch(() => {});
    }
  }
}

// Start the server
async function main() {
  const server = new DefoldMCPServer();
  try {
    await server.start();
  } catch (error) {
    console.error('Server start error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
