import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createAnthropicToolSet } from "../src/adapters/anthropic.js";
import { writeProjectConfig } from "../src/project/config.js";

const tempDirs: string[] = [];

async function createTempProject(): Promise<string> {
  const baseDir = path.resolve(".tmp-toolbridge-tests");
  await mkdir(baseDir, { recursive: true });
  const dir = await mkdtemp(path.join(baseDir, "toolbridge-anthropic-"));
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
  const baseDir = path.resolve(".tmp-toolbridge-tests");
  await rm(baseDir, { recursive: true, force: true });
});

describe("Anthropic adapter", () => {
  it("createAnthropicToolSet returns Anthropic-compatible tools", async () => {
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

    const toolSet = await createAnthropicToolSet({ projectRoot });
    expect(toolSet.tools).toHaveLength(1);
    expect(toolSet.tools[0].name).toBe("echo_echo");
    expect(toolSet.tools[0].description.length).toBeGreaterThan(0);
    expect((toolSet.tools[0].input_schema as { type?: string }).type).toBe("object");
  });

  it("executeToolUse executes echo", async () => {
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

    const toolSet = await createAnthropicToolSet({ projectRoot });
    const output = await toolSet.executeToolUse({
      name: "echo_echo",
      input: { message: "hello" }
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

    const toolSet = await createAnthropicToolSet({ projectRoot });
    const output = await toolSet.execute("echo_echo", { message: "hello direct" });

    expect(output).toEqual({ message: "hello direct" });
  });

  it("invalid non-object input should throw", async () => {
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

    const toolSet = await createAnthropicToolSet({ projectRoot });
    await expect(
      toolSet.executeToolUse({
        name: "echo_echo",
        input: "hello"
      })
    ).rejects.toThrow('Invalid Anthropic tool input for "echo_echo"');
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

    const toolSet = await createAnthropicToolSet({ projectRoot });
    await expect(
      toolSet.executeToolUse({
        name: "missing_tool",
        input: {}
      })
    ).rejects.toThrow('Tool "missing_tool" not found');
  });

  it("Date input should throw", async () => {
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

    const toolSet = await createAnthropicToolSet({ projectRoot });
    await expect(
      toolSet.executeToolUse({
        name: "echo_echo",
        input: new Date()
      })
    ).rejects.toThrow('Invalid Anthropic tool input for "echo_echo"');
  });

  it("class instance input should throw", async () => {
    class MessageInput {
      constructor(public message: string) {}
    }

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

    const toolSet = await createAnthropicToolSet({ projectRoot });
    await expect(
      toolSet.executeToolUse({
        name: "echo_echo",
        input: new MessageInput("hello")
      })
    ).rejects.toThrow('Invalid Anthropic tool input for "echo_echo"');
  });
});
