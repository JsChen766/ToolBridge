import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readManifest } from "../src/core/readManifest.js";
import { validateManifest } from "../src/core/validateManifest.js";

const tempDirs: string[] = [];

async function createTempPackage(packageJson: object, files: Record<string, string> = {}): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "toolbridge-"));
  tempDirs.push(dir);
  await writeFile(path.join(dir, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(dir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }

  return dir;
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (!dir) {
      continue;
    }
    await rm(dir, { recursive: true, force: true });
  }
});

describe("validateManifest", () => {
  it("returns ok for examples/echo-tools", async () => {
    const readResult = await readManifest(path.join("examples", "echo-tools"));
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("returns an error when agentTools is missing", async () => {
    const packageRoot = await createTempPackage({
      name: "missing-agent-tools",
      version: "0.1.0",
      type: "module"
    });

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "agentTools",
      message: "Missing agentTools field in package.json"
    });
  });

  it("returns an error when description is missing", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "missing-description",
        version: "0.1.0",
        type: "module",
        agentTools: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              inputSchema: "./schemas/echo.input.json"
            }
          }
        }
      },
      {
        "tools/echo.js": 'export async function echo(input) { return { message: input.message }; }',
        "schemas/echo.input.json": '{"type":"object","properties":{"message":{"type":"string"}}}'
      }
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "agentTools.tools.echo.description",
      message: "Required"
    });
  });

  it("returns an error when inputSchema is missing", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "missing-input-schema",
        version: "0.1.0",
        type: "module",
        agentTools: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Echo"
            }
          }
        }
      },
      {
        "tools/echo.js": 'export async function echo(input) { return { message: input.message }; }'
      }
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "agentTools.tools.echo.inputSchema",
      message: "Required"
    });
  });

  it("returns an error when tools is empty", async () => {
    const packageRoot = await createTempPackage({
      name: "empty-tools",
      version: "0.1.0",
      type: "module",
      agentTools: {
        version: "0.1",
        tools: {}
      }
    });

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "agentTools.tools",
      message: "Must declare at least one tool"
    });
  });

  it("returns an error when inputSchema file does not exist", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "missing-schema-file",
        version: "0.1.0",
        type: "module",
        agentTools: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Echo",
              inputSchema: "./schemas/missing.input.json"
            }
          }
        }
      },
      {
        "tools/echo.js": 'export async function echo(input) { return { message: input.message }; }'
      }
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "agentTools.tools.echo.inputSchema",
      message: "Schema file does not exist: ./schemas/missing.input.json"
    });
  });

  it('returns an error when inputSchema root type is not "object"', async () => {
    const packageRoot = await createTempPackage(
      {
        name: "non-object-schema-root",
        version: "0.1.0",
        type: "module",
        agentTools: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Echo",
              inputSchema: "./schemas/echo.input.json"
            }
          }
        }
      },
      {
        "tools/echo.js": 'export async function echo(input) { return { message: input.message }; }',
        "schemas/echo.input.json": '{"type":"string"}'
      }
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "agentTools.tools.echo.inputSchema",
      message: 'Schema root "type" must be "object"'
    });
  });
});
