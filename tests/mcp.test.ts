import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeProjectConfig } from "../src/project/config.js";
import { loadMcpToolDefinitions, loadProjectMcpToolDefinitions } from "../src/mcp/stdioServer.js";

const tempDirs: string[] = [];

async function createTempProject(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "toolbridge-mcp-"));
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
              inputSchema: "./schemas/echo.input.json",
              enabled: true,
              targets: { mcp: { enabled: true } }
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
});

describe("MCP definitions", () => {
  it("loads package-level MCP definitions from examples/echo-tools", async () => {
    const definitions = await loadMcpToolDefinitions(path.join("examples", "echo-tools"));

    expect(definitions).toHaveLength(1);
    expect(definitions[0].name).toBe("echo");
    expect(definitions[0].description.length).toBeGreaterThan(0);
    expect(definitions[0].inputSchema.type).toBe("object");
  });

  it("loads project-level MCP definitions with alias_toolName", async () => {
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

    const definitions = await loadProjectMcpToolDefinitions(projectRoot);
    expect(definitions).toHaveLength(1);
    expect(definitions[0].name).toBe("echo_echo");
    expect(definitions[0].inputSchema.type).toBe("object");
  });
});
