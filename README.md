# ToolBridge

One project, one bridge, selected tools only.

Install many. Declare many. Expose few.

ToolBridge is a lightweight CLI/library that turns npm package tool declarations into MCP tools through one project-level stdio bridge.
Declare once. Use through MCP or native adapters.

## Model

ToolBridge separates three layers:

- `npm install` = installed tools
- `package.json.toolbridge` (or legacy `package.json.agentTools`) = declared tools
- `toolbridge.config.json` = exposed tools

ToolBridge does not auto-expose all installed packages. Only tools selected in `toolbridge.config.json` are exposed to MCP.
ToolBridge adapters turn selected npm-declared tools into native tool formats for different agent runtimes.

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

## Use In Custom Agents

ToolBridge is not only an MCP bridge.

- For packaged Agent CLIs, use project-level MCP: `toolbridge mcp --project .`
- For custom agents, use native adapters from this package:
  - `createOpenAIToolSet`
  - `createAnthropicToolSet`

Adapters read only tools selected in `toolbridge.config.json`.
Installed packages do not automatically enter model context.
Token cost comes from exposed tool schemas, not installed packages.
ToolBridge adapters do not call the model. They only:
1. convert selected project tools into provider-compatible tool schemas
2. execute tool calls/tool uses returned by your agent runtime

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
- You still need to append the tool result back to your agent loop according to your model provider's API.
- ToolBridge does not run the model or manage the full agent loop.

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
    // send tool_result back to Anthropic in your agent loop
  }
}
```

- `executeToolUse` only executes one `tool_use` block.
- You still need to send a `tool_result` message/block back in your own agent loop.
- ToolBridge only adapts selected tools and executes tool calls.

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
claude mcp add toolbridge-project -- node "/absolute/path/to/toolbridge/dist/cli.js" mcp --project "/absolute/path/to/project"
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

## Adapter Smoke Test

```bash
npm run build
node dist/cli.js init
node dist/cli.js add ./examples/echo-tools
node examples/adapter-smoke.mjs
```

`init` may print "already exists" if config already exists. That is fine.

## Scope Limits (v0.1-alpha)

- Node/ESM tools only
- Single project-level MCP bridge per project
- No npm install/uninstall
- No marketplace/registry
- No desktop app
- No remote server
- No multi-language runtime
- No complex permission model
