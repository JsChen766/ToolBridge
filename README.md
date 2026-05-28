[![npm version](https://img.shields.io/npm/v/toolbridge?color=orange&label=npm)](https://www.npmjs.com/package/toolbridge)
![node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
[![npm downloads](https://img.shields.io/npm/dm/toolbridge?color=blue&label=downloads)](https://www.npmjs.com/package/toolbridge)
[![license](https://img.shields.io/github/license/JsChen766/ToolBridge)](https://github.com/JsChen766/ToolBridge/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/JsChen766/ToolBridge?style=flat)](https://github.com/JsChen766/ToolBridge/stargazers)

English | [中文](./README.zh-CN.md)

# ToolBridge

ToolBridge lets npm packages declare reusable AI agent tools once. Each project then chooses which tools to expose, either through a lightweight project-level MCP stdio bridge for Agent CLIs, or through native OpenAI / Anthropic adapters for custom agents.

One project, one bridge, selected tools only.  
Install many. Declare many. Expose few.

## What is ToolBridge?

ToolBridge is a lightweight Node.js CLI and library for turning npm packages into reusable AI agent tools.

A tool package declares its available tools in `package.json.toolbridge`.
A project chooses which tools to expose in `toolbridge.config.json`.
ToolBridge then exposes those selected tools to:

- Agent CLIs through one project-level MCP stdio bridge
- Custom OpenAI-compatible agents through `createOpenAIToolSet`
- Custom Anthropic-compatible agents through `createAnthropicToolSet`

## Why use ToolBridge?

- Use one project-level MCP stdio bridge instead of one MCP server per tool package.
- Keep MCP as a thin compatibility layer for Agent CLIs, not as a heavy server architecture.
- Control model context by selecting exposed tools explicitly.
- Reuse the same declared tools with MCP, OpenAI-compatible, and Anthropic-compatible runtimes.
- Keep installation, declaration, and exposure as separate steps.

ToolBridge does not remove tool schema token cost. It helps avoid unnecessary tool schema exposure.

## Is ToolBridge a heavy MCP server?

No. ToolBridge uses MCP as a transport only when connecting to MCP-compatible Agent CLIs.

ToolBridge MCP mode is lightweight because:

- it runs as a local stdio process
- it does not start an HTTP server
- it does not listen on a port
- it does not run as a background daemon
- it does not connect to a remote registry
- it does not scan `node_modules` automatically
- it exposes only tools explicitly selected in `toolbridge.config.json`

The number of MCP servers is not what determines model token cost.
Model token cost comes from the tool schemas visible to the model: tool names, descriptions, and input schemas.

If the same set of tool schemas is exposed, ToolBridge MCP mode has roughly the same model-context cost as normal tool/function calling.

ToolBridge reduces unnecessary context by separating installed tools from exposed tools.

## Core model

ToolBridge separates tools into three layers:

- Installed tools: npm packages present in the project.
- Declared tools: tools described by `package.json.toolbridge` inside those packages.
- Exposed tools: the small selected subset enabled in `toolbridge.config.json`.

Only exposed tools are converted into MCP/OpenAI/Anthropic tool schemas.

This is the main mechanism that keeps the model context small.

Installed tools are not automatically exposed.

## Installation

```bash
npm install toolbridge
```

After installing a ToolBridge-compatible npm package, ToolBridge will not expose its tools automatically.  
Run `npx toolbridge add <package>` to explicitly add selected tools to `toolbridge.config.json`.

## Project-level MCP for Agent CLIs

For Agent CLIs such as Claude Code, Codex, or Cursor, ToolBridge provides a local project-level MCP stdio bridge.

Users do not need to write a custom MCP server for each tool package.
A project registers one ToolBridge bridge, and that bridge exposes only selected tools.

Command:

```bash
toolbridge mcp --project .
```

This command is normally started by the Agent CLI after configuration. Users usually do not need to keep it running manually.

## Project-Level Quickstart

```bash
npx toolbridge init
npx toolbridge add ./examples/echo-tools
npx toolbridge inspect --project .
npx toolbridge link --project . --target claude-code --dry-run
```

`link --dry-run` only prints the Claude Code command. It does not modify user configuration.

Example command output (run manually):

```bash
claude mcp add toolbridge-project -- node "/absolute/path/to/dist/cli.js" mcp --project "/absolute/path/to/project"
```

For local development in this repository:

```bash
node dist/cli.js mcp --project .
```

## Claude Code E2E

After registration, Claude Code starts the ToolBridge stdio bridge when needed.
You do not need to manually run a long-lived server.

## Use In Custom Agents

For custom agents, you do not need MCP.
Use `createOpenAIToolSet` or `createAnthropicToolSet` to convert selected tools directly into native provider tool schemas.

### OpenAI-compatible agents

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

ToolBridge does not call the model or manage the full agent loop. It only provides tool schemas and executes returned tool calls.

### Anthropic-compatible agents

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
    // Send the tool_result back in your own agent loop.
  }
}
```

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
        "outputSchema": "./schemas/echo.output.json",
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

- `entry` points to a named ESM export.
- `inputSchema` points to a JSON Schema object and is used for input validation before execution.
- `outputSchema` is optional. It describes output contract metadata and is not enforced at runtime.
- `enabled` controls whether the tool is enabled by default.
- `targets.mcp.enabled` controls whether the tool is enabled by default for MCP.

Need a starting point for third-party tool packages?  
See `examples/tool-package-template`.

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

- `packages` keys can be npm package names or local package paths.
- `alias` is used to generate exposed tool names.
- Exposed tool name format is `alias_toolName`.
- In this example, the tool is exposed as `echo_echo`.
- Tools not listed here are not exposed.

## CLI reference

- `toolbridge init`
- `toolbridge add <package>`
- `toolbridge add <package>:<tool>`
- `toolbridge inspect --project .`
- `toolbridge inspect <package>`
- `toolbridge validate <package>`
- `toolbridge run <package> <tool> <json>`
- `toolbridge mcp --project .`
- `toolbridge mcp <package>` (legacy/debug)
- `toolbridge link --project . --target claude-code --dry-run`

## Security notes

- ToolBridge executes local npm package functions.
- Only install and expose tool packages you trust.
- ToolBridge does not automatically expose all installed packages.
- Review `toolbridge.config.json` before connecting it to an agent.

## Current limits

- Node/ESM tools only
- Project-level MCP bridge
- No marketplace
- No automatic npm install/uninstall
- No automatic node_modules scanning
- No remote server
- No desktop app

## Development

```bash
npm install
npm run typecheck
npm run test
npm run build
```

Release check:

```bash
npm pack --dry-run
```
