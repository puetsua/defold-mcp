# defold-mcp — agent guide

## Repo structure

- `index.js` is the **entire server** — single file, no entrypoint elsewhere.
- `package.json` has `"main": "index.js"` and `"bin": {"defold-mcp": "index.js"}`.
- `modules/control.lua` is the in-game HTTP control server (port 38290) that `game_click` talks to. It is shipped here so games can copy it in; it is NOT Node code.
- `modules/control.example.lua` shows the matcha-novel button → route wiring.

## Critical: many tool handlers are stubs

Only 7 of 31 tools are implemented. See [`docs/tool-handlers.md`](docs/tool-handlers.md) for the full list. Prioritize finishing the stubs.

## Mouse / click actions

Defold uses raw input — Win32 `SendInput`/`PostMessage` do not work and `SendInput` steals the cursor. Instead, the game ships `modules/control.lua` (HTTP server on port 38290, polled from `update()`). The `game_click` MCP tool is a thin HTTP GET client to `http://127.0.0.1:38290/<route>`. Pair with `screenshot_game` for visual verification. See [`docs/tool-handlers.md`](docs/tool-handlers.md#mouse--click-actions).

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