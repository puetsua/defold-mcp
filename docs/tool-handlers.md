# Tool handlers status

The `callTool()` switch (line 384 in `index.js`) routes to handlers, but most handlers beyond line 651 are not implemented. Only `launchDefold`, `runProject`, `createProject`, `listProjects`, and `getProjectSettings` have real bodies.

## Implemented

- `launch_defold`
- `run_project`
- `create_project`
- `list_projects`
- `get_project_settings`
- `game_click` — trigger a button/action in the running game via the in-game HTTP control server (`modules/control.lua` on port 38290). Thin HTTP client; does not steal the mouse.
- `screenshot_game` — capture a PNG of the running game window (base64 image content block). Pair with `game_click` for visual verification.

## Unimplemented (stubs)

- `update_project_settings`
- `create_script`
- `edit_script`
- `create_lua_module`
- `create_collection`
- `add_game_object`
- `add_component`
- `create_sprite`
- `create_tilemap`
- `create_particlefx`
- `create_sound`
- `create_camera`
- `create_factory`
- `create_gui`
- `setup_physics`
- `configure_render`
- `setup_bob`
- `build_project`
- `bundle_project`
- `debug_logs`
- `stream_logs`
- `enable_hot_reload`
- `add_native_extension`
- `get_project_analytics`

## Mouse / click actions

Defold uses raw input, so Win32 `SendInput`/`PostMessage` do not work and `SendInput` steals the physical cursor. Instead, ship `modules/control.lua` in the game — it runs a non-blocking HTTP server on `http://127.0.0.1:38290`, polled from `update()`. The MCP `game_click` tool just does an HTTP GET to `/<route>`.

Button → route example (matcha-novel):
- Start → `game_click { route: "start" }`
- Load → `game_click { route: "menu/show_load" }`
- Settings → `game_click { route: "menu/show_settings" }`
- Quit → `game_click { route: "quit" }`

Built-in routes: `_ping` (health check), `_routes` (JSON list of registered routes).

See `modules/control.lua` and `modules/control.example.lua`.