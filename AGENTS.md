# defold-mcp — agent guide

## Repo structure

- `index.js` is the **entire server** — single file, no entrypoint elsewhere.
- `package.json` has `"main": "index.js"` and `"bin": {"defold-mcp": "index.js"}`.

## Critical: many tool handlers are stubs

Only 5 of 29 tools are implemented. See [`docs/tool-handlers.md`](docs/tool-handlers.md) for the full list. Prioritize finishing the stubs.

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