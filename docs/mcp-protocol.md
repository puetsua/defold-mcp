# MCP protocol details

- **Stdout** = JSON-RPC messages (protocol); **stderr** = debug logging (safe to ignore).
- Transport is `stdio` only (WebSocket throws at `index.js:459`).
- `console.error` is used extensively for debug output — this is intentional and correct for MCP.