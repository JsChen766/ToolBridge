[![npm version](https://img.shields.io/npm/v/toolbridge?color=orange&label=npm)](https://www.npmjs.com/package/toolbridge)
![node >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
[![npm downloads](https://img.shields.io/npm/dm/toolbridge?color=blue&label=downloads)](https://www.npmjs.com/package/toolbridge)
[![license](https://img.shields.io/github/license/JsChen766/ToolBridge)](https://github.com/JsChen766/ToolBridge/blob/main/LICENSE)
[![stars](https://img.shields.io/github/stars/JsChen766/ToolBridge?style=flat)](https://github.com/JsChen766/ToolBridge/stargazers)

[English](./README.md) | 中文

# ToolBridge

**一次声明 AI Agent 工具，按项目选择暴露，多运行时复用。**

ToolBridge 是一个轻量的 TypeScript 工具库和 CLI，用来把本地文件夹或 npm 包变成可复用的 AI Agent tools。

你不需要为同一个工具反复维护 MCP server、OpenAI tool schema、Anthropic tool schema。工具包只需要在 `package.json` 中按照 ToolBridge 规范声明 tools，每个项目再通过 `toolbridge.config.json` 选择自己真正需要暴露哪些工具。

```text
本地文件夹 / npm 包
        ↓ 一次声明 tools
package.json.toolbridge
        ↓ 每个项目按需选择
toolbridge.config.json
        ↓ 暴露给
MCP / OpenAI / Anthropic
```

可以安装很多工具，可以声明很多工具，但只把当前项目真正需要的少数工具暴露给模型。

> 当前状态：early preview。v1.0 之前 API 和 CLI 行为可能发生变化。

## 为什么需要 ToolBridge？

AI Agent tools 的生态正在变得越来越碎片化。

一个有用的工具，经常需要被重复改写成给 Agent CLI 用的 MCP server、给 OpenAI-compatible Agent 用的 tool schema、给 Anthropic-compatible Agent 用的 tool schema、某个项目里的本地脚本，或者另一个项目里的可复用 npm package。

这会让工具复用变得很麻烦。

ToolBridge 想引入一种轻量的 AI Agent tool packaging convention：

1. 本地文件夹或 npm 包声明自己有哪些 tools。
2. 每个项目显式选择要暴露哪些 tools。
3. ToolBridge 把被选中的 tools 转换成 MCP、OpenAI-compatible 或 Anthropic-compatible 的工具定义。

它的目标不是把 MCP 做重，而是让工具可以跨 Agent runtime 复用，同时保持项目级的显式暴露和可审计性。

## 它解决了什么问题？

### 没有 ToolBridge 时

如果你想在多个项目之间复用 Agent tools，通常会遇到这些问题：

- 每个工具包都要单独写一个 MCP server
- 自研 Agent 项目里要手动复制 tool schema
- 安装了很多工具后，容易把不相关的工具也暴露给模型
- OpenAI、Anthropic、MCP 的工具格式要分别维护
- 本地脚本很难被打包、版本化和复用

### 使用 ToolBridge 后

你可以先把工具放在本地文件夹里开发，成熟后再发布成 npm 包；每个项目只选择自己要暴露的 tools。

```text
开发阶段：
./tools/my-tools
        ↓
toolbridge validate ./tools/my-tools

复用阶段：
@your-scope/my-agent-tools
        ↓
npx toolbridge add @your-scope/my-agent-tools

项目阶段：
toolbridge.config.json 决定模型能看到哪些工具
```

已安装工具不会自动暴露。只有 `toolbridge.config.json` 中显式选择的工具，才会被转换成模型可见的 schema。

## 适合谁？

### 工具包作者

你可以开发一个符合 ToolBridge 规范的 npm package。用户可以把你的 tools 接入 MCP-compatible Agent CLI，或者接入 OpenAI / Anthropic-compatible 自研 Agent，而不需要你为每个运行时重复写集成代码。

### 项目开发者

你可以在项目里安装很多工具，但只把当前项目真正需要的少数工具暴露给 Agent，减少无关工具对模型上下文的污染。

### 自研 Agent 开发者

你可以使用同一套 ToolBridge 声明生成 OpenAI-compatible 或 Anthropic-compatible tool schemas，不需要为每个 provider 手写一遍。

## 30 秒快速开始

```bash
npm install toolbridge

npx toolbridge init
npx toolbridge add ./examples/echo-tools
npx toolbridge inspect --project .
```

如果要接入 MCP-compatible Agent CLI：

```bash
npx toolbridge link --project . --target claude-code --dry-run
```

`--dry-run` 只会打印建议注册到 Agent CLI 的命令，不会修改用户配置。

如果你是在本仓库本地开发：

```bash
npm install
npm run build
node dist/cli.js inspect --project .
```

## 核心思路

ToolBridge 将 Agent tools 分成三层：

| 层级 | 含义 |
|---|---|
| 已安装工具 | 项目中存在的 npm 包或本地文件夹 |
| 已声明工具 | 这些包在 `package.json.toolbridge` 中声明的 tools |
| 已暴露工具 | 当前项目在 `toolbridge.config.json` 中显式启用的 tools |

只有“已暴露工具”会被转换成 MCP / OpenAI / Anthropic 的工具 schema。

这是 ToolBridge 的核心控制点：安装不等于暴露。

## 项目级 MCP bridge

对于 MCP-compatible Agent CLI，ToolBridge 提供一个本地 project-level stdio bridge。

```bash
toolbridge mcp --project .
```

你不需要为每个工具包单独写一个 MCP server。一个项目只需要注册一个 ToolBridge bridge，这个 bridge 会根据 `toolbridge.config.json` 暴露被选中的 tools。

ToolBridge 的 MCP bridge 是轻量的：

- 本地 stdio 进程
- 不启动 HTTP 服务
- 不监听端口
- 不作为后台 daemon 常驻
- 不连接远程 registry
- 不自动扫描 `node_modules`
- 只做项目级显式暴露

ToolBridge 不会消除 tool schema 的 token 成本。只要工具暴露给模型，tool name、description、input schema 仍然会占用上下文。ToolBridge 的价值是把“已安装工具”和“已暴露工具”分开，避免无关工具被暴露。

## 在自研 Agent 中使用

如果你在开发自己的 Agent，不一定需要 MCP。ToolBridge 可以直接生成 provider 原生工具定义。

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
    // 在你自己的 agent loop 中把 tool_result 发回模型。
  }
}
```

ToolBridge 不负责调用模型，也不管理完整 agent loop。它只负责提供 tool schema，并执行模型返回的 tool call。

## 真实 API 验证

ToolBridge 已在真实 DeepSeek OpenAI-compatible 和 Anthropic-compatible API 接口上完成测试。

测试验证了：

- ToolBridge 生成的 OpenAI-compatible tool schema 可以附加到真实 OpenAI 风格请求中。
- ToolBridge 生成的 Anthropic-compatible tool schema 可以附加到真实 Anthropic 风格请求中。
- 模型会基于这些 schema 触发 `tool_call` / `tool_use`。
- ToolBridge 可以执行模型返回的工具调用。
- 工具执行结果可以回传给模型。
- 模型在收到工具结果后，可以返回正确的最终答案。

这说明 ToolBridge 不只是 schema converter，也可以作为真实 agent-style API flow 中的工具执行层使用。

说明：该验证证明 ToolBridge 已兼容本次测试的 DeepSeek OpenAI-compatible 和 Anthropic-compatible 接口。不同服务商的 tool calling 行为和 API 兼容性可能存在差异。

```text
npm install toolbridge
-> 声明本地工具
-> 生成 OpenAI / Anthropic 兼容工具 schema
-> 将 schema 附加到真实模型请求
-> 模型返回 tool_call / tool_use
-> ToolBridge 执行工具
-> 将工具结果回传给模型
-> 获得最终答案
```

## 工具包声明方式

符合 ToolBridge 规范的包，需要在 `package.json` 中声明 tools：

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

字段说明：

- `entry`：指向 ESM 文件中的具名导出函数。
- `description`：暴露给模型看的工具描述。
- `inputSchema`：JSON Schema，用于执行前的输入校验。
- `outputSchema`：可选的输出契约 metadata，当前不会在运行时强制校验。
- `enabled`：该工具默认是否可用。
- `targets.mcp.enabled`：该工具默认是否倾向于暴露给 MCP。

第三方工具包可以从 [`examples/tool-package-template`](./examples/tool-package-template) 开始。

## 项目配置

项目通过 `toolbridge.config.json` 选择要暴露哪些包和工具：

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

说明：

- `packages` 的 key 可以是 npm 包名，也可以是本地路径。
- `alias` 用来生成暴露给模型的工具名。
- 暴露名格式是 `alias_toolName`。
- 上例中暴露名是 `echo_echo`。
- 未在这里选择的 tools 不会被暴露。

通过 npm 安装 ToolBridge-compatible 工具包后，ToolBridge 不会自动暴露其中的 tools。你需要显式运行 `npx toolbridge add <package>`，将需要的工具加入 `toolbridge.config.json`。

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

## 常见工作流

### 创建本地工具文件夹

```bash
mkdir -p tools/my-tools
# 添加 package.json、工具入口文件和 schemas
npx toolbridge validate ./tools/my-tools
npx toolbridge add ./tools/my-tools
npx toolbridge inspect --project .
```

### 发布可复用 npm tool package

```bash
npm publish
```

然后其他用户就可以添加它：

```bash
npx toolbridge add your-tool-package
```

### 把项目接入 MCP-compatible Agent CLI

```bash
npx toolbridge link --project . --target claude-code --dry-run
```

然后把打印出来的命令注册到你的 Agent CLI 中。

## 安全说明

ToolBridge 会执行本地 package 中声明的函数。请把 ToolBridge-compatible tool package 当作可执行代码对待。

- 只安装和暴露你信任的工具包。
- 连接到 Agent 之前，先检查 `toolbridge.config.json`。
- 谨慎暴露文件系统、shell、网络、凭证相关工具。
- ToolBridge 不会自动暴露 `node_modules` 中的所有工具。

## 当前限制

- 仅支持 Node/ESM tools
- 以 project-level MCP stdio bridge 为主
- 不提供 marketplace
- 不负责自动 npm install/uninstall
- 不自动扫描 `node_modules`
- 不提供 remote server
- 不提供 desktop app
- `outputSchema` 目前只是 metadata，暂不做运行时强制校验

## 开发

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

## Roadmap

近期方向：

- 改进 package discovery 和校验错误提示
- 提供更完整的工具包模板
- 扩展更多 Agent CLI linking target
- 补充第三方工具包作者文档
- 在 v1.0 前稳定公开 config 和 package declaration schema

## License

MIT
