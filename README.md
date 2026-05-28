# ToolBridge

One project, one bridge, selected tools only.

Install many. Declare many. Expose few.

ToolBridge is a lightweight CLI/library that turns npm package tool declarations into MCP tools through one project-level stdio bridge.

## Model

ToolBridge separates three layers:

- `npm install` = installed tools
- `package.json.toolbridge` (or legacy `package.json.agentTools`) = declared tools
- `toolbridge.config.json` = exposed tools

ToolBridge does not auto-expose all installed packages. Only tools selected in `toolbridge.config.json` are exposed to MCP.

## Project-Level Quickstart

```bash
npm install
npm run build

npm run dev -- init
npm run dev -- add ./examples/echo-tools
npm run dev -- inspect --project .
npm run dev -- link --project . --target claude-code --dry-run
npm run dev -- mcp --project .
```

`toolbridge mcp --project .` is the recommended mode.

Legacy/debug mode is still available:

```bash
toolbridge mcp ./examples/echo-tools
```

## Package Tool Declaration

Recommended package manifest field:

```json
{
  "toolbridge": {
    "version": "0.1",
    "tools": {
      "echo": {
        "entry": "./tools/echo.js#echo",
        "description": "Echo back a plain text message.",
        "inputSchema": "./schemas/echo.input.json",
        "enabled": true,
        "targets": {
          "mcp": {
            "enabled": true
          }
        }
      }
    }
  }
}
```

Legacy `agentTools` is still supported. ToolBridge reads `toolbridge` first, then falls back to `agentTools`.

Required per tool:

- `entry`
- `description`
- `inputSchema`

Optional per tool:

- `enabled`
- `targets.mcp.enabled`

`entry` format:

```text
./file.js#exportName
```

Tool function contract:

- input: JSON object
- output: JSON-serializable object

```js
export async function echo(input) {
  return { message: input.message };
}
```

## Project Config

Create in project root:

```json
{
  "version": "0.1",
  "packages": {
    "./examples/echo-tools": {
      "alias": "echo",
      "enabled": true,
      "targets": {
        "mcp": {
          "enabled": true
        }
      },
      "tools": {
        "echo": {
          "enabled": true
        }
      }
    }
  }
}
```

Exposed tool names are generated as:

```text
<alias>_<toolName>
```

For the example above, MCP exposes:

```text
echo_echo
```

## CLI Commands

- `toolbridge init`
- `toolbridge add <package>`
- `toolbridge add <package>:<tool>`
- `toolbridge inspect <package>`
- `toolbridge inspect --project .`
- `toolbridge validate <package>`
- `toolbridge run <package> <tool> <json>`
- `toolbridge mcp --project .` (recommended)
- `toolbridge mcp <package>` (legacy/debug)
- `toolbridge link --project . --target claude-code --dry-run` (recommended)
- `toolbridge link <package> --target claude-code --dry-run` (legacy/debug)

## Claude Code Link Preview

ToolBridge currently provides dry-run preview only (no automatic config write):

```bash
toolbridge link --project . --target claude-code --dry-run
toolbridge link ./examples/echo-tools --target claude-code --dry-run
```

Example output for project mode:

```bash
claude mcp add toolbridge-project -- node /absolute/path/to/toolbridge/dist/cli.js mcp --project /absolute/path/to/project
```

## Manual E2E with Claude Code

```bash
npm install
npm run build

npm run dev -- init
npm run dev -- add ./examples/echo-tools
npm run dev -- mcp --project .
```

In another terminal:

```bash
claude mcp add toolbridge-project -- node /absolute/path/to/toolbridge/dist/cli.js mcp --project /absolute/path/to/toolbridge
```

Then ask in Claude Code:

```text
Use the echo_echo tool to echo {"message":"hello from ToolBridge"}.
```

## Scope Limits (v0.1-alpha)

- Node/ESM tools only
- Single project-level MCP bridge per project
- No npm install/uninstall
- No marketplace/registry
- No desktop app
- No remote server
- No multi-language runtime
- No complex permission model
