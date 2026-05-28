# ToolBridge

Expose npm-installed functions as MCP tools.

Tool authors should not need to write a full MCP server. They only declare tools in `package.json`, and ToolBridge exposes them through a lightweight MCP stdio adapter.

## Quickstart

```bash
npm install
npm run build

npm run dev -- inspect ./examples/echo-tools
npm run dev -- validate ./examples/echo-tools
npm run dev -- run ./examples/echo-tools echo '{"message":"hello"}'
npm run dev -- mcp ./examples/echo-tools
npm run dev -- link ./examples/echo-tools --target claude-code --dry-run
```

## agentTools v0.1 spec

Declare tools in your package `package.json`:

```json
{
  "agentTools": {
    "version": "0.1",
    "tools": {
      "echo": {
        "entry": "./tools/echo.js#echo",
        "description": "Echo a message back to the user.",
        "inputSchema": "./schemas/echo.input.json"
      }
    }
  }
}
```

Rules for each tool in `agentTools.tools`:

- `entry`: required, non-empty, format `./file.js#exportName`
- `description`: required, non-empty
- `inputSchema`: required, must point to a valid JSON Schema file

Rules for the manifest:

- `agentTools.version` must be `"0.1"`
- `agentTools.tools` must contain at least one tool

## Tool function contract

Tool functions should accept a JSON object and return a JSON-serializable object:

```js
export async function echo(input) {
  return { message: input.message };
}
```

## CLI commands

- `toolbridge inspect <package>`: show tools in a package
- `toolbridge validate <package>`: validate `agentTools` manifest
- `toolbridge run <package> <tool> <json>`: execute one tool locally
- `toolbridge mcp <package>`: run MCP stdio bridge for one package
- `toolbridge link <package> --target claude-code --dry-run`: preview Claude Code MCP add command without writing config

## Claude Code / local MCP config

Published tool package:

```bash
claude mcp add echo-tools -- npx -y toolbridge mcp @demo/echo-tools
```

`@demo/echo-tools` should be an npm package that is already published and contains `agentTools` in its `package.json`.

Local development path:

```bash
npm run build
claude mcp add echo-tools -- node /absolute/path/to/toolbridge/dist/cli.js mcp /absolute/path/to/toolbridge/examples/echo-tools
```

## Manual E2E test with Claude Code

```bash
npm install
npm run build

node dist/cli.js inspect ./examples/echo-tools
node dist/cli.js validate ./examples/echo-tools
node dist/cli.js run ./examples/echo-tools echo '{"message":"hello"}'

claude mcp add echo-tools -- node /absolute/path/to/toolbridge/dist/cli.js mcp /absolute/path/to/toolbridge/examples/echo-tools
```

In Claude Code, ask the model:

```text
Use the echo tool to echo {"message":"hello from ToolBridge"}.
```

If this fails, check:

- Node version
- `dist/cli.js` exists
- `examples/echo-tools` path is absolute in the Claude command
- Claude Code successfully added the MCP server

## Link dry-run examples

ToolBridge supports command preview only in v0.1-alpha:

```bash
toolbridge link @demo/echo-tools --target claude-code --dry-run
toolbridge link ./examples/echo-tools --target claude-code --dry-run
```

This command does not execute `claude mcp add` and does not write any user configuration.

## Current limits (v0.1)

- v0.1 only supports Node/ESM tools
- v0.1 only supports exposing one package at a time
- v0.1 does not do npm install/uninstall
- v0.1 does not do marketplace features
- v0.1 does not do project scanning
