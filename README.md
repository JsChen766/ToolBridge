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

## Claude Code / local MCP config

With published package:

```bash
claude mcp add echo-tools -- npx -y toolbridge mcp ./examples/echo-tools
```

Local development path:

```bash
claude mcp add echo-tools -- node /absolute/path/to/toolbridge/dist/cli.js mcp /absolute/path/to/examples/echo-tools
```

## Current limits (v0.1)

- v0.1 only supports Node/ESM tools
- v0.1 only supports exposing one package at a time
- v0.1 does not do npm install/uninstall
- v0.1 does not do marketplace features
- v0.1 does not do project scanning
