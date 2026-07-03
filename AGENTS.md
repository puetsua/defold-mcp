# defold-mcp — agent guide

## Repo structure

- `index.js` is the **entire server** — single file, no entrypoint elsewhere.
- `package.json` has `"main": "index.js"` and `"bin": {"defold-mcp": "index.js"}`.

## Critical: many tool handlers are stubs

Only 9 of 31 tools are implemented. Unimplemented tools are hidden from `tools/list` (see `IMPLEMENTED_TOOLS` in `index.js`). See [`docs/tool-handlers.md`](docs/tool-handlers.md) for the full list. Prioritize finishing the stubs.

## Driving a running game

Use Defold's **built-in engine service** (present in debug builds, no in-game code required):

- `run_script` runs arbitrary Lua in the game via `POST /post/@system/run_script` — this triggers any game action, including "clicking" a button by calling its handler or posting an input action.
- `hot_reload` hits `/post/@resource/reload`; `engine_info` does `GET /info`.

Default port 8001, but when launched from the editor `DM_SERVICE_PORT` is `"dynamic"` (random) — pass the port, or find it via the `dmengine` process's listening ports (`GET /info` confirms). Pair with `screenshot_game` for visual verification. See [`docs/tool-handlers.md`](docs/tool-handlers.md#driving-a-running-game).

## Commands

```sh
npm install           # install deps
npm start             # node index.js — runs the MCP server on stdio
npm test              # syntax-only check: node --check index.js
```

No lint, no typecheck, no formatter — don't look for them.

## Platform

- `DEFOLD_PATH` defaults to macOS path. Override in `.env` for Windows/Linux.
- **Node >= 18** required.

## Further reading

- [`docs/mcp-protocol.md`](docs/mcp-protocol.md) — stdio/stderr conventions
- [`docs/bob.md`](docs/bob.md) — bob.jar build tool, JDK 21 requirement
- [`SETUP.md`](SETUP.md) — agent setup instructions