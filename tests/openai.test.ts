import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createOpenAIToolSet } from "../src/adapters/openai.js";
import { writeProjectConfig } from "../src/project/config.js";

const tempDirs: string[] = [];
const OPENAI_TMP_DIR = path.resolve(".tmp-toolbridge-tests-openai");

async function createTempProject(): Promise<string> {
  await mkdir(OPENAI_TMP_DIR, { recursive: true });
  const dir = await mkdtemp(path.join(OPENAI_TMP_DIR, "toolbridge-openai-"));
  tempDirs.push(dir);
  return dir;
}

async function writeEchoPackage(projectRoot: string): Promise<void> {
  const packageRoot = path.join(projectRoot, "examples", "echo-tools");
  await mkdir(path.join(packageRoot, "tools"), { recursive: true });
  await mkdir(path.join(packageRoot, "schemas"), { recursive: true });

  await writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify(
      {
        name: "echo-tools",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Echo back a plain text message.",
              inputSchema: "./schemas/echo.input.json"
            }
          }
        }
      },
      null,
      2
    ),
    "utf8"
  );
  await writeFile(
    path.join(packageRoot, "tools", "echo.js"),
    'export async function echo(input) { return { message: input.message }; }',
    "utf8"
  );
  await writeFile(
    path.join(packageRoot, "schemas", "echo.input.json"),
    '{"type":"object","properties":{"message":{"type":"string"}},"required":["message"],"additionalProperties":false}',
    "utf8"
  );
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
  await rm(OPENAI_TMP_DIR, { recursive: true, force: true });
});

describe("OpenAI adapter", () => {
  it("createOpenAIToolSet returns OpenAI-compatible tools", async () => {
    const projectRoot = await createTempProject();
    await writeEchoPackage(projectRoot);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    const toolSet = await createOpenAIToolSet({ projectRoot });
    expect(toolSet.tools).toHaveLength(1);
    expect(toolSet.tools[0].type).toBe("function");
    expect(toolSet.tools[0].function.name).toBe("echo_echo");
    expect(toolSet.tools[0].function.description.length).toBeGreaterThan(0);
    expect((toolSet.tools[0].function.parameters as { type?: string }).type).toBe("object");
  });

  it("executeToolCall executes echo", async () => {
    const projectRoot = await createTempProject();
    await writeEchoPackage(projectRoot);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    const toolSet = await createOpenAIToolSet({ projectRoot });
    const output = await toolSet.executeToolCall({
      type: "function",
      function: {
        name: "echo_echo",
        arguments: '{"message":"hello"}'
      }
    });

    expect(output).toEqual({ message: "hello" });
  });

  it("execute(name, input) executes echo", async () => {
    const projectRoot = await createTempProject();
    await writeEchoPackage(projectRoot);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    const toolSet = await createOpenAIToolSet({ projectRoot });
    const output = await toolSet.execute("echo_echo", { message: "hello direct" });

    expect(output).toEqual({ message: "hello direct" });
  });

  it("invalid JSON arguments should throw", async () => {
    const projectRoot = await createTempProject();
    await writeEchoPackage(projectRoot);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    const toolSet = await createOpenAIToolSet({ projectRoot });
    await expect(
      toolSet.executeToolCall({
        type: "function",
        function: {
          name: "echo_echo",
          arguments: "{bad json"
        }
      })
    ).rejects.toThrow('Invalid OpenAI tool call arguments for "echo_echo": invalid JSON');
  });

  it("unknown tool name should throw", async () => {
    const projectRoot = await createTempProject();
    await writeEchoPackage(projectRoot);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    const toolSet = await createOpenAIToolSet({ projectRoot });
    await expect(
      toolSet.executeToolCall({
        type: "function",
        function: {
          name: "missing_tool",
          arguments: "{}"
        }
      })
    ).rejects.toThrow('Tool "missing_tool" not found');
  });

  it("missing function.name should throw", async () => {
    const projectRoot = await createTempProject();
    await writeEchoPackage(projectRoot);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    const toolSet = await createOpenAIToolSet({ projectRoot });
    await expect(
      toolSet.executeToolCall({
        type: "function",
        function: {
          name: "",
          arguments: "{}"
        }
      } as unknown as Parameters<typeof toolSet.executeToolCall>[0])
    ).rejects.toThrow("Invalid OpenAI tool call: missing function.name");
  });

  it("non-string function.arguments should throw expected string error", async () => {
    const projectRoot = await createTempProject();
    await writeEchoPackage(projectRoot);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    const toolSet = await createOpenAIToolSet({ projectRoot });
    await expect(
      toolSet.executeToolCall({
        type: "function",
        function: {
          name: "echo_echo",
          arguments: 123 as unknown as string
        }
      })
    ).rejects.toThrow('Invalid OpenAI tool call arguments for "echo_echo": expected string');
  });
});
