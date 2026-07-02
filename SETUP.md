# Setup

Setup instructions for using the defold-mcp server with **OpenCode**, **Claude Code**, **Codex CLI**, **Cursor**, and **Claude Desktop**.

## Prerequisites

- **Node.js >= 18**
- **npm install** — installs dependencies

## Environment

Create `.env` in the project root:

```ini
DEFOLD_PATH=/Applications/Defold.app/Contents/MacOS/Defold
BOB_PATH=$HOME/defold/bob-1.9.6.jar
MCP_HOST=localhost
MCP_PORT=37415
```

| Variable | Description |
|----------|-------------|
| `DEFOLD_PATH` | Path to the Defold editor binary |
| `BOB_PATH` | Path to `bob.jar` (optional, auto-discovered or downloaded via `setup_bob`) |


`DEFOLD_PATH` defaults differ by platform:

| Platform | Default path |
|----------|-------------|
| macOS | `/Applications/Defold.app/Contents/MacOS/Defold` |
| Windows | `C:\Program Files\Defold\Defold.exe` (set explicitly) |
| Linux | `/usr/bin/Defold` (set explicitly) |

## Per-agent setup

The server runs via `node index.js` over stdio transport. `opencode.json` ships with the repo for auto-detection. All other agents require you to add the config to their respective settings file.

### OpenCode

**Config:** `opencode.json` (project root — auto-detected)

OpenCode reads this file automatically. No manual setup needed.

```json
{
  "mcpServers": {
    "@puetsua/defold-mcp": {
      "command": "node",
      "args": ["index.js"],
      "env": {
        "DEFOLD_PATH": "",
        "BOB_PATH": ""
      }
    }
  }
}
```

Set `DEFOLD_PATH` in your `.env` file or directly in the config.

### Claude Code

**Config:** add to `~/.claude/settings.json` (global) or place at `.claude/settings.json` in the project.

```json
{
  "mcpServers": {
    "@puetsua/defold-mcp": {
      "command": "node",
      "args": ["${workspaceFolder}/index.js"],
      "env": {
        "DEFOLD_PATH": "",
        "BOB_PATH": ""
      }
    }
  }
}
```

`${workspaceFolder}` resolves to the project root. The `CLAUDE.md` file in the project root provides tool documentation.

### Codex CLI

**Config:** add to `~/.codex/config.json` (global) or place at `.codex/config.json` in the project.

```json
{
  "mcpServers": {
    "@puetsua/defold-mcp": {
      "command": "node",
      "args": ["${workspaceFolder}/index.js"],
      "env": {
        "DEFOLD_PATH": "",
        "BOB_PATH": ""
      }
    }
  }
}
```

### Cursor

**Config:** add to `.cursor/mcp.json` in the project or configure via Cursor settings UI.

```json
{
  "mcpServers": {
    "@puetsua/defold-mcp": {
      "command": "node",
      "args": ["${workspaceFolder}/index.js"],
      "env": {
        "DEFOLD_PATH": "",
        "MCP_PORT": "37415",
        "MCP_HOST": "localhost",
        "BOB_PATH": ""
      }
    }
  }
}
```

### Claude Desktop

**Config:** `claude_desktop_config.json` (global — not project-level)

Unlike coding agents, Claude Desktop uses a **global config file**. Edit the file at the path for your OS:

| Platform | Config path |
|----------|-------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

Add the server entry under `mcpServers`. Use **absolute paths** — `node` must be the full path to the Node binary, and `args` must be the full path to `index.js`:

```json
{
  "mcpServers": {
    "@puetsua/defold-mcp": {
      "command": "/path/to/node",
      "args": ["/path/to/defold-mcp/index.js"],
      "env": {
        "DEFOLD_PATH": "/path/to/Defold",
        "BOB_PATH": ""
      }
    }
  }
}
```

To find your Node path: `which node` (macOS/Linux) or `where node` (Windows).

To find your defold-mcp path: `cd /path/to/defold-mcp && pwd` (or `cd` on Windows).

## Manual setup (any agent)

If your agent supports MCP but doesn't have a dedicated config file here, add the following to your agent's MCP configuration:

```json
{
  "mcpServers": {
    "@puetsua/defold-mcp": {
      "command": "node",
      "args": ["/path/to/defold-mcp/index.js"],
      "env": {
        "DEFOLD_PATH": "/path/to/Defold"
      }
    }
  }
}
```

Replace `/path/to/defold-mcp` and `/path/to/Defold` with actual paths for your system.

## Verify the server is working

The server should respond to a `tools/list` JSON-RPC request with 29 tools. Run:

```bash
node index.js
```

If the server starts without errors, the setup is correct.

## Example agent prompt

Copy this into your favorite agent to have it configure defold-mcp automatically:

> Read `SETUP.md` in this project and follow the instructions to configure
> defold-mcp as an MCP server for my agent. Use the correct config format
> for your agent type (OpenCode, Claude Code, Codex CLI, Cursor, or
> Claude Desktop). Use absolute paths where needed.
