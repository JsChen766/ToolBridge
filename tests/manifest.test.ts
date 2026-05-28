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

const echoFiles = {
  "tools/echo.js": 'export async function echo(input) { return { message: input.message }; }',
  "schemas/echo.input.json":
    '{"type":"object","properties":{"message":{"type":"string"}},"required":["message"],"additionalProperties":false}',
  "schemas/echo.output.json":
    '{"type":"object","properties":{"message":{"type":"string"}},"required":["message"],"additionalProperties":false}'
};

afterEach(async () => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe("manifest compatibility and validation", () => {
  it("returns ok for examples/echo-tools using toolbridge namespace", async () => {
    const readResult = await readManifest(path.join("examples", "echo-tools"));
    const result = await validateManifest(readResult);

    expect(readResult.manifestNamespace).toBe("toolbridge");
    expect(result.ok).toBe(true);
  });

  it("prefers toolbridge over agentTools when both exist", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "both-manifests",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "From toolbridge",
              inputSchema: "./schemas/echo.input.json"
            }
          }
        },
        agentTools: {
          version: "0.1",
          tools: {
            wrong: {
              entry: "./tools/missing.js#wrong",
              description: "From agentTools",
              inputSchema: "./schemas/missing.input.json"
            }
          }
        }
      },
      echoFiles
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(readResult.manifestNamespace).toBe("toolbridge");
    expect(result.ok).toBe(true);
  });

  it("falls back to agentTools when toolbridge is missing", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "legacy-agent-tools",
        version: "0.1.0",
        type: "module",
        agentTools: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Legacy manifest",
              inputSchema: "./schemas/echo.input.json"
            }
          }
        }
      },
      echoFiles
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(readResult.manifestNamespace).toBe("agentTools");
    expect(result.ok).toBe(true);
  });

  it("returns an error when both toolbridge and agentTools are missing", async () => {
    const packageRoot = await createTempPackage({
      name: "missing-manifest",
      version: "0.1.0",
      type: "module"
    });

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "toolbridge",
      message: "Missing toolbridge or agentTools field in package.json"
    });
  });

  it("returns an error when description is missing", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "missing-description",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              inputSchema: "./schemas/echo.input.json"
            }
          }
        }
      },
      echoFiles
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "toolbridge.tools.echo.description",
      message: "Required"
    });
  });

  it("returns ok when optional outputSchema is present and valid", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "valid-output-schema",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Echo output schema",
              inputSchema: "./schemas/echo.input.json",
              outputSchema: "./schemas/echo.output.json"
            }
          }
        }
      },
      echoFiles
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(true);
  });

  it("returns an error when outputSchema file does not exist", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "missing-output-schema",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Echo output schema",
              inputSchema: "./schemas/echo.input.json",
              outputSchema: "./schemas/missing.output.json"
            }
          }
        }
      },
      echoFiles
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "toolbridge.tools.echo.outputSchema",
      message: "Schema file does not exist: ./schemas/missing.output.json"
    });
  });

  it("returns an error when outputSchema is invalid JSON", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "invalid-output-schema-json",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Echo output schema",
              inputSchema: "./schemas/echo.input.json",
              outputSchema: "./schemas/echo.output.json"
            }
          }
        }
      },
      {
        ...echoFiles,
        "schemas/echo.output.json": "{invalid-json"
      }
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path === "toolbridge.tools.echo.outputSchema")).toBe(true);
  });

  it('returns an error when outputSchema root "type" is not "object"', async () => {
    const packageRoot = await createTempPackage(
      {
        name: "invalid-output-schema-root",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Echo output schema",
              inputSchema: "./schemas/echo.input.json",
              outputSchema: "./schemas/echo.output.json"
            }
          }
        }
      },
      {
        ...echoFiles,
        "schemas/echo.output.json": '{"type":"array","items":{"type":"string"}}'
      }
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "toolbridge.tools.echo.outputSchema",
      message: 'Schema root "type" must be "object"'
    });
  });

  it("returns an error when outputSchema cannot be compiled by AJV", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "invalid-output-schema-ajv",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Echo output schema",
              inputSchema: "./schemas/echo.input.json",
              outputSchema: "./schemas/echo.output.json"
            }
          }
        }
      },
      {
        ...echoFiles,
        "schemas/echo.output.json":
          '{"type":"object","properties":{"message":{"type":123}},"required":["message"],"additionalProperties":false}'
      }
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.path === "toolbridge.tools.echo.outputSchema")).toBe(true);
  });

  it("returns an error when entry export is missing", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "missing-entry-export",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#missing",
              description: "Missing export",
              inputSchema: "./schemas/echo.input.json"
            }
          }
        }
      },
      echoFiles
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "toolbridge.tools.echo.entry",
      message: 'Entry export "missing" not found in ./tools/echo.js'
    });
  });

  it("returns an error when entry export is not a function", async () => {
    const packageRoot = await createTempPackage(
      {
        name: "entry-export-not-function",
        version: "0.1.0",
        type: "module",
        toolbridge: {
          version: "0.1",
          tools: {
            echo: {
              entry: "./tools/echo.js#echo",
              description: "Not a function",
              inputSchema: "./schemas/echo.input.json"
            }
          }
        }
      },
      {
        ...echoFiles,
        "tools/echo.js": 'export const echo = "not-a-function";'
      }
    );

    const readResult = await readManifest(packageRoot);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toContainEqual({
      path: "toolbridge.tools.echo.entry",
      message: 'Entry export "echo" is not a function in ./tools/echo.js'
    });
  });
});
