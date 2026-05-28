[English](./README.md) | 中文

# ToolBridge

一个项目，一个桥接，只暴露你选中的工具。

Install many. Declare many. Expose few.

ToolBridge 让 npm 包只声明一次工具，然后在项目级别按需暴露：  
既可以通过 MCP 提供给 Agent CLI，也可以转换为 OpenAI / Anthropic 的原生工具格式供自研 Agent 使用。

## ToolBridge 是什么

ToolBridge 专注三层分离：

- `npm install` = 已安装工具（installed tools）
- `package.json.toolbridge` / `package.json.agentTools` = 已声明工具（declared tools）
- `toolbridge.config.json` = 已暴露工具（exposed tools）

重点是：不会自动把所有已安装包暴露给模型上下文，只有配置里明确启用的工具才会进入工具集。

## 快速开始（项目级 MCP）

```bash
npm install
npm run build

npx toolbridge init
npx toolbridge add ./examples/echo-tools
npx toolbridge inspect --project "."
npx toolbridge link --project "." --target claude-code --dry-run
npx toolbridge mcp --project "."
```

推荐方式是 `mcp --project "."`。  
`mcp <package>` 仍保留，但仅建议用于单包调试（legacy/debug）。

## 自研 Agent 中使用 Adapter

ToolBridge adapter 不负责调用模型，也不负责完整 agent loop。它只做两件事：

1. 把项目中已选择的工具转换为 provider 兼容的工具 schema
2. 执行模型返回的单个 tool call / tool use

### OpenAI-compatible

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
  // 你需要自己把 tool 输出回写到消息流
}
```

### Anthropic-compatible

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
    // 你需要自己发送 tool_result block/message
  }
}
```

## package.json.toolbridge 声明规范

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

兼容旧字段 `agentTools`，但推荐新项目使用 `toolbridge`。

## toolbridge.config.json（项目配置）

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

暴露给模型的工具名规则：

```text
<alias>_<toolName>
```

例如 `echo_echo`。

## CLI 命令

- `toolbridge init`
- `toolbridge add <package>`
- `toolbridge add <package>:<tool>`
- `toolbridge inspect <package>`
- `toolbridge inspect --project "."`
- `toolbridge validate <package>`
- `toolbridge run <package> <tool> <json>`
- `toolbridge mcp --project "."`（推荐）
- `toolbridge mcp <package>`（legacy/debug）
- `toolbridge link --project "." --target claude-code --dry-run`（推荐）
- `toolbridge link <package> --target claude-code --dry-run`（legacy/debug）

Windows 提示：  
不要对绝对路径 `E:\...` 使用 `:tool` 后缀，改用相对路径或 npm 包名。

## Claude Code E2E

```bash
npm run build
node dist/cli.js init
node dist/cli.js add ./examples/echo-tools
node dist/cli.js inspect --project "."
claude mcp add toolbridge-project -- node "/absolute/path/to/toolbridge/dist/cli.js" mcp --project "/absolute/path/to/project"
```

然后在 Claude Code 里请求：

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

预期可看到：

- OpenAI tools 中有 `echo_echo`
- Anthropic tools 中有 `echo_echo`
- `hello openai adapter`
- `hello anthropic adapter`

## 发布前检查

```bash
npm run typecheck
npm run test
npm run build
npm pack --dry-run
```

## 当前边界（v0.1.0）

- 不做 marketplace
- 不做 desktop app
- 不做 remote server
- 不做 Docker 必选流程
- 不做 npm install/uninstall 管理
- 不自动扫描并暴露 node_modules 全量工具
