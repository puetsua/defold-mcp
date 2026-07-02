# defold-mcp

This project is a Model Context Protocol (MCP) server for the Defold game engine.

## MCP Server

- **Entry point:** `index.js`
- **Run:** `node index.js`
- **Transport:** stdio (configured via `MCP_TRANSPORT` env var)

## Available Tools

- `launch_defold` - Launch Defold editor
- `run_project` - Run project in debug mode
- `create_project` - Create new Defold project
- `list_projects` - List Defold projects in a directory
- `get_project_settings` - Read game.project settings
- `update_project_settings` - Update game.project settings
- `create_script` - Create Lua script
- `edit_script` - Edit existing Lua script
- `create_lua_module` - Create reusable Lua module
- `create_collection` - Create collection
- `add_game_object` - Add game object to collection
- `add_component` - Add component to game object
- `create_sprite` - Create sprite asset
- `create_tilemap` - Create tilemap asset
- `create_particlefx` - Create particle effect
- `create_sound` - Create sound component
- `create_camera` - Create camera component
- `create_factory` - Create factory component
- `create_gui` - Create GUI scene and script
- `setup_physics` - Configure physics collision object
- `configure_render` - Configure render settings
- `setup_bob` - Configure/download bob.jar
- `build_project` - Build for target platform
- `bundle_project` - Bundle for distribution
- `debug_logs` - Capture debug logs
- `stream_logs` - Stream real-time logs
- `enable_hot_reload` - Enable hot-reload via file watching
- `add_native_extension` - Add native extension
- `get_project_analytics` - Project modification analytics

## Configuration

Copy `.env.example` to `.env` and set:
- `DEFOLD_PATH` - Path to Defold editor binary
- `BOB_PATH` - Path to bob.jar (optional, auto-downloaded)
- `MCP_TRANSPORT` - Transport mode (stdio or ws)

## Platform Notes

- **macOS**: Default DEFOLD_PATH is `/Applications/Defold.app/Contents/MacOS/Defold`
- **Windows**: Set DEFOLD_PATH to the Defold editor executable
- **Linux**: Set DEFOLD_PATH to the Defold editor binary
