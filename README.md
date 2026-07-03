# defold-mcp

MCP server for the [Defold](https://defold.com) game engine.

## Agent Setup

Paste this one-liner into your agent to have it configure defold-mcp automatically:

```
Fetch https://raw.githubusercontent.com/puetsua/defold-mcp/refs/heads/main/SETUP.md and follow it to configure defold-mcp as an MCP server for this agent, using the correct config format for your agent type and absolute paths.
```

## Getting Started

Add the MCP server to your agent config:

```json
{
  "mcpServers": {
    "defold-mcp": {
      "command": "npx",
      "args": ["@puetsua/defold-mcp"],
      "env": {
        "DEFOLD_PATH": "C:\\Program Files\\Defold\\Defold.exe"
      }
    }
  }
}
```

Set `DEFOLD_PATH` to your Defold editor binary:

| Platform | Path |
|----------|------|
| Windows | `C:\Program Files\Defold\Defold.exe` |
| macOS | `/Applications/Defold.app/Contents/MacOS/Defold` |
| Linux | `/usr/bin/Defold` |

## Tools

| Tool | Description |
|------|-------------|
| `launch_defold` | Launch Defold editor |
| `run_project` | Run project in debug mode |
| `create_project` | Create new Defold project |
| `list_projects` | List Defold projects in a directory |
| `get_project_settings` | Read game.project settings |
| `update_project_settings` | Update game.project settings |
| `create_script` | Create Lua script |
| `edit_script` | Edit existing Lua script |
| `create_lua_module` | Create reusable Lua module |
| `create_collection` | Create collection |
| `add_game_object` | Add game object to collection |
| `add_component` | Add component to game object |
| `create_sprite` | Create sprite asset |
| `create_tilemap` | Create tilemap asset |
| `create_particlefx` | Create particle effect |
| `create_sound` | Create sound component |
| `create_camera` | Create camera component |
| `create_factory` | Create factory component |
| `create_gui` | Create GUI scene and script |
| `setup_physics` | Configure physics collision object |
| `configure_render` | Configure render settings |
| `setup_bob` | Configure/download bob.jar |
| `build_project` | Build for target platform |
| `bundle_project` | Bundle for distribution |
| `debug_logs` | Capture debug logs |
| `stream_logs` | Stream real-time logs |
| `enable_hot_reload` | Enable hot-reload via file watching |
| `add_native_extension` | Add native extension |
| `get_project_analytics` | Project modification analytics |

## License

MIT — Fork of [ChadAragorn/defold-mcp](https://github.com/ChadAragorn/defold-mcp).
