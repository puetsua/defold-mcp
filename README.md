# defold-mcp

MCP server for the [Defold](https://defold.com) game engine — compatible with **OpenCode**, **Claude Code**, **Codex CLI**, **Cursor**, and **Claude Desktop**.

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

## Getting Started

```bash
git clone <repo-url> defold-mcp
cd defold-mcp
npm install
cp .env.example .env   # edit DEFOLD_PATH for your OS
```

**Windows**: `DEFOLD_PATH = C:\Program Files\Defold\Defold.exe`
**macOS**: `DEFOLD_PATH = /Applications/Defold.app/Contents/MacOS/Defold`

## Agent Setup

See [`SETUP.md`](SETUP.md) for detailed setup instructions for OpenCode, Claude Code, Codex CLI, Cursor, and Claude Desktop.

## Build & Bundle

Use `setup_bob` to download `bob.jar`, then `build_project` / `bundle_project` for your target platform.

## License

MIT
