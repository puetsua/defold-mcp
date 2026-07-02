# defold-mcp — agent guide

## Repo structure

- `index.js` is the **entire server** — single file, no entrypoint elsewhere.
- `package.json` has `"main": "index.js"` and `"bin": {"defold-mcp": "./index.js"}`.

## Critical: many tool handlers are stubs

The `callTool()` switch (line 384) routes to handlers, but **most handlers beyond line 651 are not implemented** — only `launchDefold`, `runProject`, `createProject`, `listProjects`, and `getProjectSettings` have real bodies. The rest (`createScript`, `editScript`, `createCollection`, `createSprite`, etc.) are either missing entirely or just placeholder comments. Any agent working on this repo should prioritize finishing the stubs.

List of unimplemented handlers (confirmed by reading `index.js`):
`updateProjectSettings`, `createScript`, `editScript`, `createLuaModule`, `createCollection`, `addGameObject`, `addComponent`, `createSprite`, `createTilemap`, `createParticlefx`, `createSound`, `createCamera`, `createFactory`, `createGui`, `setupPhysics`, `configureRender`, `setupBob`, `buildProject`, `bundleProject`, `debugLogs`, `streamLogs`, `enableHotReload`, `addNativeExtension`, `getProjectAnalytics`

## Commands

```sh
npm install           # install deps (just @modelcontextprotocol/sdk + utils)
npm start             # node index.js — runs the MCP server on stdio
npm test              # syntax-only check: node -e "require('./index.js')"
```

No lint, no typecheck, no formatter, no CI — do not waste time looking for them.

## MCP protocol details

- **Stdout** = JSON-RPC messages (protocol); **stderr** = debug logging (safe to ignore).
- Transport is `stdio` only. Setting `MCP_TRANSPORT=ws` throws at runtime (`index.js:459`).
- `console.error` is used extensively for debug output — this is intentional and correct for MCP.

## bob.jar (build tool)

- Required by: `build_project`, `bundle_project`, `add_native_extension`, `setup_bob`.
- Enforces **OpenJDK 21** at runtime (`index.js:498-500`). Older or newer JDK versions will fail validation.
- Auto-discovered via `DEFOLD_PATH` / `~/defold/bob.jar` / `/usr/local/bin/bob.jar`. Falls back to `setup_bob` tool which downloads from GitHub releases.

## Platform

- `DEFOLD_PATH` defaults to macOS path (`/Applications/Defold.app/...`). Override in `.env` for Windows/Linux.
- **Node >= 18** required (`package.json` engines field).

## Agent configs already in place

| Agent | File |
|-------|------|
| OpenCode | `opencode.json` |
| Claude Code | `.claude/settings.json` + `CLAUDE.md` |
| Codex CLI | `.codex/config.json` |
| Cursor | `.cursor/mcp.json` |

All configs use `node index.js` as the MCP server command over stdio transport. No additional agent wiring needed.
