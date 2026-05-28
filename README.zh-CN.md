[![npm version](https://img.shields.io/npm/v/toolbridge?color=orange&label=npm)](https://www.npmjs.com/package/toolbridge)
![node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
[![npm downloads](https://img.shields.io/npm/dm/toolbridge?color=blue&label=downloads)](https://www.npmjs.com/package/toolbridge)
[![license](https://img.shields.io/github/license/JsChen766/ToolBridge)](https://github.com/JsChen766/ToolBridge/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/JsChen766/ToolBridge?style=flat)](https://github.com/JsChen766/ToolBridge/stargazers)

[English](./README.md) | 中文

# ToolBridge

ToolBridge 是一个 Node.js CLI 和工具库，用来让 npm 包一次声明可复用的 AI Agent tools，再由每个项目按需选择暴露哪些工具。你可以把这些已选择的工具通过轻量的项目级 MCP stdio bridge 提供给 Agent CLI，或直接转换为 OpenAI / Anthropic 的原生工具格式用于自研 Agent。

一个项目，一个 bridge，只暴露选中的工具。  
可以安装很多、声明很多，但只暴露必要的少数工具。

## ToolBridge 是什么？

ToolBridge 的核心是把“安装工具”“声明工具”“暴露工具”分开管理。

工具包作者在 `package.json.toolbridge` 中声明可用 tools。
项目使用者在 `toolbridge.config.json` 中选择要暴露的 tools。
ToolBridge 再把这些已选择工具接入到不同运行环境：

- Claude Code、Codex、Cursor 等支持 MCP 的 Agent CLI（通过一个项目级 MCP stdio bridge）
- OpenAI-compatible 自研 Agent（通过 `createOpenAIToolSet`）
- Anthropic-compatible 自研 Agent（通过 `createAnthropicToolSet`）

## 为什么需要 ToolBridge？

- 用一个项目级 MCP stdio bridge，替代“每个工具包一个 MCP server”。
- 把 MCP 保持为 Agent CLI 的薄兼容层，而不是重型服务架构。
- 通过显式选择 exposed tools 控制模型上下文规模。
- 同一套声明可复用到 MCP、OpenAI-compatible、Anthropic-compatible 运行时。
- 将安装、声明、暴露拆分，便于治理和审计。

ToolBridge 不会消除 tool schema 的 token 成本；它的价值是避免不必要的 tool 暴露。

## ToolBridge 会不会是一个很重的 MCP server？

不会。ToolBridge 只有在接入 Claude Code、Codex、Cursor 这类 MCP-compatible Agent CLI 时，才使用 MCP 作为通信协议。

它在 MCP 模式下是轻量的，因为：

- 作为本地 stdio 进程运行
- 不启动 HTTP 服务
- 不监听端口
- 不作为后台 daemon 常驻
- 不连接远程 registry
- 不自动扫描 `node_modules`
- 只暴露 `toolbridge.config.json` 中显式选择的 tools

真正影响模型 token 成本的，不是 MCP server 的数量，而是模型能看到多少 tool schema。
这些 schema 通常包括 tool name、description、input schema。

如果暴露的是同一组 tools，那么 ToolBridge 的 MCP 模式与普通 tool/function calling 在模型上下文成本上是同一量级。

ToolBridge 控制成本的方式不是“消除 tool schema token”，而是把 installed tools 和 exposed tools 分离，只暴露必要的少量工具。

## 核心模型

ToolBridge 将工具分为三层：

- 已安装工具：项目中通过 npm 安装的包。
- 已声明工具：这些包在 `package.json.toolbridge` 中声明的 tools。
- 已暴露工具：当前项目在 `toolbridge.config.json` 中启用的 tools。

只有“已暴露工具”的 schema 会进入模型上下文，并被转换为 MCP/OpenAI/Anthropic 对应格式。

这是控制上下文规模的核心机制。

已安装工具不会被自动暴露。

## 安装

```bash
npm install toolbridge
```

通过 npm 安装 ToolBridge-compatible 工具包后，ToolBridge 不会自动暴露其中的 tools。  
你需要显式运行 `npx toolbridge add <package>`，将需要的工具加入 `toolbridge.config.json`。

## 面向 Agent CLI 的轻量项目级 MCP bridge

对于 Claude Code、Codex、Cursor 这类成品 Agent CLI，ToolBridge 提供一个本地 project-level MCP stdio bridge。

你不需要为每个工具包单独编写 MCP server。
一个项目只注册一个 ToolBridge bridge，由它根据 `toolbridge.config.json` 暴露选中的 tools。

命令：

```bash
toolbridge mcp --project .
```

这个命令通常由 Agent CLI 在完成配置后按需启动，用户一般不需要手动长期运行它。

## Project-Level Quickstart

```bash
npx toolbridge init
npx toolbridge add ./examples/echo-tools
npx toolbridge inspect --project .
npx toolbridge link --project . --target claude-code --dry-run
```

`link --dry-run` 只打印建议执行的 Claude Code 命令，不会自动修改用户配置。

示例（手动执行）：

```bash
claude mcp add toolbridge-project -- node "/absolute/path/to/dist/cli.js" mcp --project "/absolute/path/to/project"
```

本仓库本地开发时，也可以直接运行：

```bash
node dist/cli.js mcp --project .
```

## Claude Code E2E

完成注册后，Claude Code 会在需要时自动启动 ToolBridge 的 stdio bridge。
通常不需要手动维护一个长期运行的 server 进程。

## Use In Custom Agents

如果你是在开发自己的 Agent，不一定需要 MCP。
可以直接使用 `createOpenAIToolSet` 和 `createAnthropicToolSet`，把已选择工具转换为 provider 原生 schema。

### OpenAI-compatible Agent

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

ToolBridge 不负责调用模型，也不管理完整 agent loop。
它只负责提供 tool schema 并执行模型返回的 tool call。

### Anthropic-compatible Agent

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
    // 在你自己的 agent loop 中发送 tool_result。
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

- `entry`：指向 ESM 文件中的具名导出函数。
- `inputSchema`：指向 JSON Schema 对象，并在执行前用于输入校验。
- `outputSchema`：可选字段，用于描述输出契约/文档 metadata，当前不做运行时强制校验。
- `enabled`：控制该工具默认是否启用。
- `targets.mcp.enabled`：控制该工具默认是否对 MCP 启用。

如果你需要第三方工具包模板，可参考 `examples/tool-package-template`。

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

- `packages` 的 key 可以是 npm 包名，也可以是本地路径。
- `alias` 用于生成暴露给模型的工具名。
- 暴露名格式是 `alias_toolName`。
- 上例暴露名是 `echo_echo`。
- 未在这里列出的 tools 不会被暴露。

## CLI reference

- `toolbridge init`
- `toolbridge add <package>`
- `toolbridge add <package>:<tool>`
- `toolbridge inspect --project .`
- `toolbridge inspect <package>`
- `toolbridge validate <package>`
- `toolbridge run <package> <tool> <json>`
- `toolbridge mcp --project .`
- `toolbridge mcp <package>`（legacy/debug）
- `toolbridge link --project . --target claude-code --dry-run`

## Security notes

- ToolBridge 会执行本地 npm 包中声明的函数。
- 请只安装并暴露你信任的工具包。
- ToolBridge 不会自动暴露所有已安装包。
- 在连接到 Agent 之前，请检查 `toolbridge.config.json`。

## Current limits

- 仅支持 Node/ESM tools
- 以 project-level MCP bridge 为主
- 不提供 marketplace
- 不负责 npm install/uninstall 自动管理
- 不会自动扫描 node_modules
- 不提供 remote server
- 不提供 desktop app

## Development

```bash
npm install
npm run typecheck
npm run test
npm run build
```

发布前检查：

```bash
npm pack --dry-run
```
