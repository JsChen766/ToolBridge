<!-- [![npm version](https://img.shields.io/npm/v/toolbridge?color=orange&label=npm)](https://www.npmjs.com/package/toolbridge) -->
![node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
[![npm downloads](https://img.shields.io/npm/dm/toolbridge?color=blue&label=downloads)](https://www.npmjs.com/package/toolbridge)
[![license](https://img.shields.io/github/license/JsChen766/ToolBridge)](https://github.com/JsChen766/ToolBridge/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/JsChen766/ToolBridge?style=flat)](https://github.com/JsChen766/ToolBridge/stargazers)

English | [中文](./README.zh-CN.md)

# ToolBridge

One project, one bridge, selected tools only.

Install many. Declare many. Expose few.

ToolBridge lets npm packages declare agent tools once, then exposes only selected tools through MCP or native adapters for OpenAI-compatible and Anthropic-compatible agent runtimes.

- Use one project-level MCP bridge instead of one MCP server per tool package.
- Convert selected npm-declared tools into OpenAI / Anthropic native tool schemas.
- Keep installed tools, declared tools, and exposed tools strictly separated.
- Avoid exposing every installed package to the model context.
- No marketplace, daemon, remote server, or automatic node_modules scanning.

## Installation

```bash
npm install toolbridge
```

```bash
npx toolbridge --help
```

## Model

ToolBridge separates three layers:

- `npm install` = installed tools
- `package.json.toolbridge` (or legacy `package.json.agentTools`) = declared tools
- `toolbridge.config.json` = exposed tools

ToolBridge adapters do not call the model. They only:

1. convert selected project tools into provider-compatible tool schemas
2. execute tool calls/tool uses returned by your agent runtime

## Project-Level Quickstart

```bash
npm install
npm run build

npx toolbridge init
npx toolbridge add ./examples/echo-tools
npx toolbridge inspect --project "."
npx toolbridge link --project "." --target claude-code --dry-run
npx toolbridge mcp --project "."
```

Recommended mode: `toolbridge mcp --project "."`

Legacy/debug mode (single package):

```bash
toolbridge mcp ./examples/echo-tools
```

Package-level mode is useful for debugging one tool package. Project-level mode is recommended for real agent usage.

## Use In Custom Agents

ToolBridge adapters turn selected npm-declared tools into native tool formats for different agent runtimes.

Adapters read only tools selected in `toolbridge.config.json`.
Installed packages do not automatically enter model context.
Token cost comes from exposed tool schemas, not installed packages.

### OpenAI-Compatible Example

```ts
import { createOpenAIToolSet } from "toolbridge";

const toolSet = await createOpenAIToolSet({ projectRoot: "." });

const response = await client.chat.completions.create({
  model: "your-model",
  messages,
  tools: toolSet.tools
});

for (const toolCall of response.choices[0].message.tool_calls ?? []) {
  const output = await toolSet.executeToolCall(toolCall);
  messages.push({
    role: "tool",
    tool_call_id: toolCall.id,
    content: JSON.stringify(output)
  });
}
```

- `executeToolCall` only executes one returned tool call.
- You still need to append tool results in your own agent loop.
- ToolBridge does not run the model or manage the full loop.

### Anthropic-Compatible Example

```ts
import { createAnthropicToolSet } from "toolbridge";

const toolSet = await createAnthropicToolSet({ projectRoot: "." });

const response = await anthropic.messages.create({
  model: "your-model",
  messages,
  tools: toolSet.tools
});

for (const block of response.content) {
  if (block.type === "tool_use") {
    const output = await toolSet.executeToolUse(block);
    // send tool_result back in your agent loop
  }
}
```

- `executeToolUse` only executes one `tool_use` block.
- You still need to send a `tool_result` block/message yourself.
- ToolBridge only adapts selected tools and executes tool calls.

## Package Tool Declaration

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

Legacy `agentTools` is still supported.

## Project Config

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

Exposed tool name format:

```text
<alias>_<toolName>
```

Example: `echo_echo`

## CLI Commands

- `toolbridge init`
- `toolbridge add <package>`
- `toolbridge add <package>:<tool>`
- `toolbridge inspect <package>`
- `toolbridge inspect --project "."`
- `toolbridge validate <package>`
- `toolbridge run <package> <tool> <json>`
- `toolbridge mcp --project "."` (recommended)
- `toolbridge mcp <package>` (legacy/debug)
- `toolbridge link --project "." --target claude-code --dry-run` (recommended)
- `toolbridge link <package> --target claude-code --dry-run` (legacy/debug)

Windows note for `add <package>:<tool>`:

- Do not use `:tool` suffix with absolute paths like `E:\...`.
- Use a relative path: `toolbridge add ./examples/echo-tools:echo`
- Or use an npm package name: `toolbridge add @scope/pkg:toolName`

## Claude Code E2E

```bash
npm run build
node dist/cli.js init
node dist/cli.js add ./examples/echo-tools
node dist/cli.js inspect --project "."
claude mcp add toolbridge-project -- node "/absolute/path/to/toolbridge/dist/cli.js" mcp --project "/absolute/path/to/project"
```

Then ask:

```text
Use the echo_echo tool with message set to hello from project bridge.
```

## Adapter Smoke Test

```bash
npm run build
node dist/cli.js init
node dist/cli.js add ./examples/echo-tools
node examples/adapter-smoke.mjs
```

Expected output includes:

- OpenAI tools with `echo_echo`
- Anthropic tools with `echo_echo`
- `hello openai adapter`
- `hello anthropic adapter`

## Publish Checklist

```bash
npm run typecheck
npm run test
npm run build
npm pack --dry-run
```

`npm pack --dry-run` helps verify publish contents before release.

<!-- ## Scope Limits (v0.1.0)

- No marketplace
- No desktop app
- No remote server
- No Docker workflow requirement
- No package manager features (`npm install` / `uninstall`)
- No automatic node_modules scan-and-expose behavior -->
