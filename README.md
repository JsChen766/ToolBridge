[![npm version](https://img.shields.io/npm/v/toolbridge?color=orange&label=npm)](https://www.npmjs.com/package/toolbridge)
![node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
[![npm downloads](https://img.shields.io/npm/dm/toolbridge?color=blue&label=downloads)](https://www.npmjs.com/package/toolbridge)
[![license](https://img.shields.io/github/license/JsChen766/ToolBridge)](https://github.com/JsChen766/ToolBridge/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/JsChen766/ToolBridge?style=flat)](https://github.com/JsChen766/ToolBridge/stargazers)

English | [中文](./README.zh-CN.md)

# ToolBridge

**Declare AI agent tools once. Select per project. Expose anywhere.**

ToolBridge is a lightweight TypeScript library and CLI for building reusable AI agent tools from local folders or npm packages.

Instead of writing a separate MCP server, OpenAI tool schema, or Anthropic tool definition for every integration, a tool package declares its tools once in `package.json`. Each project then chooses which tools to expose through `toolbridge.config.json`.

```text
local folder / npm package
        ↓ declares tools once
package.json.toolbridge
        ↓ selected per project
toolbridge.config.json
        ↓ exposed to
MCP / OpenAI / Anthropic
```

Install many tools. Declare many tools. Expose only the few your current project actually needs.

> Status: early preview. APIs and CLI behavior may change before v1.0.

## Why ToolBridge?

AI agent tools are becoming fragmented.

A useful tool often has to be rewritten as an MCP server for agent CLIs, an OpenAI-compatible tool schema, an Anthropic-compatible tool schema, a local script for one project, or a reusable npm package for another project.

This makes tool reuse harder than it should be.

ToolBridge introduces a small packaging convention for AI agent tools:

1. A local folder or npm package declares available tools.
2. A project explicitly selects which tools to expose.
3. ToolBridge converts the selected tools into MCP, OpenAI-compatible, or Anthropic-compatible tool definitions.

The goal is not to make MCP heavier. The goal is to make tools reusable across agent runtimes while keeping exposure project-specific and explicit.

## What problem does it solve?

### Without ToolBridge

If you want to share agent tools across projects, you usually end up with one of these patterns:

- write one MCP server per tool package
- copy tool schemas into every custom agent project
- expose too many tools to the model because they are installed
- maintain different schema formats for different providers
- keep local scripts that are hard to package, version, or reuse

### With ToolBridge

You can keep tools in a local folder while developing them, publish them as npm packages when they become reusable, and expose only selected tools in each project.

```text
Development stage:
./tools/my-tools
        ↓
toolbridge validate ./tools/my-tools

Reusable stage:
@your-scope/my-agent-tools
        ↓
npx toolbridge add @your-scope/my-agent-tools

Project stage:
toolbridge.config.json chooses what the model can see
```

Installed tools are not automatically exposed. Only tools selected in `toolbridge.config.json` are converted into model-visible schemas.

## Who is it for?

### Tool package authors

Create a ToolBridge-compatible npm package once. Users can then expose your tools to MCP-compatible agent CLIs or custom OpenAI/Anthropic-compatible agents without you rewriting the integration for each runtime.

### Project developers

Install many tool packages, but expose only the subset needed by the current project. This helps keep the model context focused and easier to audit.

### Custom agent builders

Use one tool declaration format, then generate OpenAI-compatible or Anthropic-compatible tool schemas programmatically.

## 30-second quickstart

```bash
npm install toolbridge

npx toolbridge init
npx toolbridge add ./examples/echo-tools
npx toolbridge inspect --project .
```

For an MCP-compatible agent CLI:

```bash
npx toolbridge link --project . --target claude-code --dry-run
```

`--dry-run` only prints the command you can register in your agent CLI. It does not modify user configuration.

For local development inside this repository:

```bash
npm install
npm run build
node dist/cli.js inspect --project .
```

## Core idea

ToolBridge separates agent tools into three layers:

| Layer | Meaning |
|---|---|
| Installed tools | Packages or local folders available in the project |
| Declared tools | Tools described by `package.json.toolbridge` |
| Exposed tools | Tools explicitly enabled in `toolbridge.config.json` |

Only exposed tools are converted into MCP/OpenAI/Anthropic tool schemas.

This is the main control point: installation does not mean exposure.

## Project-level MCP bridge

For MCP-compatible agent CLIs, ToolBridge provides a local project-level stdio bridge.

```bash
toolbridge mcp --project .
```

You do not need to write one MCP server for every tool package. A project registers one ToolBridge bridge, and that bridge exposes only the tools selected in `toolbridge.config.json`.

The MCP bridge is intentionally lightweight:

- local stdio process
- no HTTP server
- no listening port
- no background daemon
- no remote registry
- no automatic `node_modules` scanning
- explicit project-level exposure only

ToolBridge does not remove tool schema token cost. If a tool is exposed to the model, its name, description, and input schema still take context. ToolBridge helps reduce unnecessary exposure by separating installed tools from exposed tools.

## Use in custom agents

For custom agents, you do not have to use MCP. ToolBridge can generate provider-native tool definitions directly.

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

ToolBridge does not call the model or manage the full agent loop. It provides tool schemas and executes returned tool calls.

## Live API verification

ToolBridge has been tested against real DeepSeek OpenAI-compatible and Anthropic-compatible API endpoints.

The live smoke test verified that:

- ToolBridge-generated OpenAI-compatible tool schemas can be attached to real OpenAI-style requests.
- ToolBridge-generated Anthropic-compatible tool schemas can be attached to real Anthropic-style requests.
- The model can trigger `tool_call` / `tool_use` from those schemas.
- ToolBridge can execute the returned tool calls.
- Tool execution results can be sent back to the model.
- The model can produce the correct final answer after receiving the tool result.

This confirms that ToolBridge works not only as a schema converter, but also as a tool execution layer in real agent-style API flows.

Note: this verification confirms compatibility with the tested DeepSeek OpenAI-compatible and Anthropic-compatible endpoints. Other providers may differ in tool-calling behavior or API compatibility.

```text
npm install toolbridge
-> declare local tools
-> generate OpenAI/Anthropic-compatible tool schemas
-> attach schemas to a real model request
-> model returns tool_call / tool_use
-> ToolBridge executes the tool
-> send tool result back to the model
-> final answer
```

## Package tool declaration

A ToolBridge-compatible package declares tools in `package.json`:

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

Field meanings:

- `entry`: points to a named ESM export.
- `description`: shown to the model as the tool description.
- `inputSchema`: JSON Schema used for input validation before execution.
- `outputSchema`: optional output contract metadata. It is not enforced at runtime yet.
- `enabled`: default package-level tool availability.
- `targets.mcp.enabled`: default MCP exposure preference.

Need a starting point for third-party tool packages? See [`examples/tool-package-template`](./examples/tool-package-template).

## Project config

A project chooses which packages and tools to expose in `toolbridge.config.json`:

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

Notes:

- `packages` keys can be npm package names or local package paths.
- `alias` is used to generate exposed tool names.
- Exposed tool name format is `alias_toolName`.
- In this example, the tool is exposed as `echo_echo`.
- Tools not selected here are not exposed.

After installing a ToolBridge-compatible npm package, ToolBridge will not expose its tools automatically. Run `npx toolbridge add <package>` to explicitly add selected tools to `toolbridge.config.json`.

## CLI reference

```bash
toolbridge init
toolbridge add <package>
toolbridge add <package>:<tool>
toolbridge inspect --project .
toolbridge inspect <package>
toolbridge validate <package>
toolbridge run <package> <tool> <json>
toolbridge mcp --project .
toolbridge mcp <package>
toolbridge link --project . --target claude-code --dry-run
```

## Common workflows

### Build a local tool folder

```bash
mkdir -p tools/my-tools
# add package.json, tool entry files, and schemas
npx toolbridge validate ./tools/my-tools
npx toolbridge add ./tools/my-tools
npx toolbridge inspect --project .
```

### Publish a reusable npm tool package

```bash
npm publish
```

Then users can add it:

```bash
npx toolbridge add your-tool-package
```

### Connect a project to an MCP-compatible agent CLI

```bash
npx toolbridge link --project . --target claude-code --dry-run
```

Then register the printed command in your agent CLI.

## Security notes

ToolBridge executes local package functions. Treat ToolBridge-compatible tool packages like executable code.

- Only install and expose packages you trust.
- Review `toolbridge.config.json` before connecting it to an agent.
- Avoid exposing broad filesystem, shell, network, or credential-related tools unless you fully understand their behavior.
- ToolBridge does not automatically expose everything installed in `node_modules`.

## Current limits

- Node/ESM tools only
- Project-level MCP stdio bridge
- No marketplace
- No automatic npm install/uninstall
- No automatic `node_modules` scanning
- No remote server
- No desktop app
- Output schema is metadata only and is not enforced at runtime yet

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

## Roadmap

Near-term direction:

- improve package discovery and validation messages
- add richer tool package templates
- expand agent CLI linking targets
- document third-party package author guidelines
- stabilize the public config and package declaration schema before v1.0

## License

MIT
