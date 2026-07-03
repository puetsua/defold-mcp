# Tool handlers status

The `callTool()` switch routes to handlers, but most handlers are not implemented. Only the tools in the `IMPLEMENTED_TOOLS` set (near the top of `index.js`) have real bodies.

Unimplemented tools are **hidden from `tools/list`** and, if called directly, return `"Tool \"<name>\" is declared but not yet implemented."` with `isError: true` — they no longer throw. When you finish a stub, add its name to `IMPLEMENTED_TOOLS` to advertise it.

## Implemented

- `launch_defold`
- `run_project`
- `create_project`
- `list_projects`
- `get_project_settings`
- `engine_info` — `GET /info` on Defold's built-in engine service (debug builds). Returns version/platform/sha1/log_port; doubles as a health check.
- `run_script` — run arbitrary Lua in the running game via `POST /post/@system/run_script`. Engine-native; no in-game code required.
- `hot_reload` — reload compiled resources via `POST /post/@resource/reload`.
- `screenshot_game` — capture a PNG of the running game window (base64 image content block). Pair with `run_script` for visual verification.

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

## Driving a running game

Drive the game through Defold's built-in **engine service**. Every debug build runs a small HTTP server (default port **8001**, or `DM_SERVICE_PORT`). When launched from the editor, `DM_SERVICE_PORT` is `"dynamic"` — the OS picks a random port — so pass the actual port to the tools, or launch with `DM_SERVICE_PORT=8001` to pin it. Not present in release bundles.

- `run_script { script: 'require("main.menu").start()' }` → `POST /post/@system/run_script` (a `RunScript` protobuf). Runs any Lua, so it can trigger any game action — including "clicking" a button by calling its handler or posting an input action.
- `hot_reload { resources: "/main/player.scriptc" }` → `POST /post/@resource/reload` (a `Reload` protobuf).
- `engine_info { }` → `GET /info`, returns `{version, platform, sha1, log_port}`.

The protobuf bodies are hand-encoded in `index.js` (no dependency); message shapes: `RunScript{module:LuaModule{source:LuaSource{script,filename}}}` and `Reload{resources:repeated string}`.

### Finding the port and reading output

- The engine service port and `log_port` are OS-assigned when launched from the editor. Find them via the `dmengine` process's listening TCP ports; `GET /info` confirms which is the engine service and reports `log_port`.
- The **log service** (`log_port`, a plain TCP stream) carries `print()`/`DEBUG:SCRIPT:` output — connect to it to observe the effect of a `run_script` call.

### "Clicking" a button

There's no pixel-level click; a Defold button is just a handler. Two equivalent approaches via `run_script`:
- Call the function the button invokes directly, e.g. `require("main.menu").start()`.
- Post the same message/input action the button would generate, e.g. `msg.post("main:/gui#menu", "start")`.

### `run_script` safety (read before injecting Lua)

The chunk runs in the engine's `@system` context, which has **no current script instance / socket**. Two consequences:

1. **Relative `msg.post` fails.** `msg.post("textbox", ...)` errors with *"Could not find socket ''"* because there's no sender to resolve against. Use **absolute** URLs — e.g. `msg.post("main:/matchanovel/textbox", ...)` — or, if the game routes messages through a helper table, temporarily redirect it to absolute paths before calling in.
2. **Always wrap the body in `pcall`.** An unhandled error in the chunk propagates to the engine's error handling. A game that installs `sys.set_error_handler` and calls `sys.exit` on error (a common "fail fast" pattern) **will quit** when your injected chunk throws. `pcall` keeps the error yours:

   ```lua
   local ok, err = pcall(function()
     -- ... your calls, using absolute msg.post URLs ...
   end)
   if not ok then print("[MCP] "..tostring(err)) end
   ```

   Note `pcall` only contains *synchronous* errors in your chunk. A message you post that makes another script error on a later frame is outside the `pcall` and can still trip the game's handler.

Verified live against AquaBlue Days (Defold 1.13.0): a bare `matchanovel.start()` (relative posts) tripped the game's `fail_on_error` → `sys.exit`; the same call with absolute routing inside `pcall` started the visual novel with the game staying up.