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

Package-level mode is useful for debugging a single tool package, but project-level mode is recommended for real agent usage.
Project-level mode keeps one MCP server per project and exposes only selected tools from `toolbridge.config.json`.

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

Windows note for `add <package>:<tool>`:

- On Windows, do not use `:tool` suffix with absolute paths like `E:\...`.
- Use a relative path instead: `toolbridge add ./examples/echo-tools:echo`
- Or use an npm package name: `toolbridge add @scope/pkg:toolName`

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

1. Build:

```bash
npm install
npm run build
```

2. Create project config:

```bash
node dist/cli.js init
node dist/cli.js add ./examples/echo-tools
node dist/cli.js inspect --project .
```

3. Add to Claude Code:

```bash
claude mcp add toolbridge-project -- node "<absolute path>/dist/cli.js" mcp --project "<absolute project path>"
```

4. Start Claude Code and ask:

```text
Use the echo_echo tool with message set to hello from project bridge.
```

Optional local smoke test:

```bash
npm run dev -- mcp --project .
```

For Claude Code E2E, do not keep this command running manually.
Claude Code starts the stdio command automatically after `claude mcp add`.

## Scope Limits (v0.1-alpha)

- Node/ESM tools only
- Single project-level MCP bridge per project
- No npm install/uninstall
- No marketplace/registry
- No desktop app
- No remote server
- No multi-language runtime
- No complex permission model
