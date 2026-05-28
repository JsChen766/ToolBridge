import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { addCommand } from "../src/commands/add.js";
import { initCommand } from "../src/commands/init.js";
import { inspectCommand } from "../src/commands/inspect.js";
import {
  getProjectConfigPath,
  readProjectConfig,
  writeProjectConfig,
  type ProjectConfig
} from "../src/project/config.js";
import { loadProjectToolSet } from "../src/project/loadProjectToolSet.js";

const tempDirs: string[] = [];

async function createTempProject(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "toolbridge-project-"));
  tempDirs.push(dir);
  return dir;
}

async function writePackage(
  projectRoot: string,
  relativePackagePath: string,
  packageJson: object,
  files: Record<string, string>
): Promise<string> {
  const packageRoot = path.join(projectRoot, relativePackagePath);
  await mkdir(packageRoot, { recursive: true });
  await writeFile(path.join(packageRoot, "package.json"), JSON.stringify(packageJson, null, 2), "utf8");

  for (const [relativePath, content] of Object.entries(files)) {
    const absolutePath = path.join(packageRoot, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, content, "utf8");
  }

  return packageRoot;
}

function createEchoPackageJson(
  toolOverrides: Record<string, unknown> = {},
  extraTools: Record<string, unknown> = {}
): object {
  return {
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
          ...toolOverrides
        },
        ...extraTools
      }
    }
  };
}

const defaultFiles = {
  "tools/echo.js": 'export async function echo(input) { return { message: input.message }; }',
  "tools/shout.js": 'export async function shout(input) { return { message: String(input.message).toUpperCase() }; }',
  "schemas/echo.input.json":
    '{"type":"object","properties":{"message":{"type":"string"}},"required":["message"],"additionalProperties":false}',
  "schemas/shout.input.json":
    '{"type":"object","properties":{"message":{"type":"string"}},"required":["message"],"additionalProperties":false}'
};

afterEach(async () => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe("project config and toolset", () => {
  it("init creates empty project config", async () => {
    const projectRoot = await createTempProject();
    await initCommand({ project: projectRoot });

    const configRaw = await readFile(getProjectConfigPath(projectRoot), "utf8");
    const config = JSON.parse(configRaw) as ProjectConfig;
    expect(config).toEqual({ version: "0.1", packages: {} });
  });

  it("add ./examples/echo-tools writes package entry to config", async () => {
    const projectRoot = await createTempProject();
    await writePackage(projectRoot, "examples/echo-tools", createEchoPackageJson(), defaultFiles);
    await initCommand({ project: projectRoot });
    await addCommand("./examples/echo-tools", { project: projectRoot });

    const config = await readProjectConfig(projectRoot);
    expect(config.packages["./examples/echo-tools"]).toBeDefined();
    expect(config.packages["./examples/echo-tools"].tools?.echo?.enabled).toBe(true);
  });

  it("add ./examples/echo-tools:echo only enables requested tool", async () => {
    const projectRoot = await createTempProject();
    await writePackage(
      projectRoot,
      "examples/echo-tools",
      createEchoPackageJson({}, {
        shout: {
          entry: "./tools/shout.js#shout",
          description: "Shout message.",
          inputSchema: "./schemas/shout.input.json"
        }
      }),
      defaultFiles
    );
    await initCommand({ project: projectRoot });
    await addCommand("./examples/echo-tools:echo", { project: projectRoot });

    const config = await readProjectConfig(projectRoot);
    expect(Object.keys(config.packages["./examples/echo-tools"].tools ?? {})).toEqual(["echo"]);
  });

  it("loadProjectToolSet generates exposedName alias_toolName", async () => {
    const projectRoot = await createTempProject();
    await writePackage(projectRoot, "examples/echo-tools", createEchoPackageJson(), defaultFiles);
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

    const projectToolSet = await loadProjectToolSet(projectRoot);
    expect(projectToolSet.tools).toHaveLength(1);
    expect(projectToolSet.tools[0].exposedName).toBe("echo_echo");
  });

  it("inspect --project prints exposed tools", async () => {
    const projectRoot = await createTempProject();
    await writePackage(projectRoot, "examples/echo-tools", createEchoPackageJson(), defaultFiles);
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

    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.join(" "));
    });

    await inspectCommand(undefined, { project: projectRoot });
    const output = lines.join("\n");
    expect(output).toMatch(/Exposed tools:/);
    expect(output).toMatch(/echo_echo/);
  });

  it("throws clear error for non-existent tool in config", async () => {
    const projectRoot = await createTempProject();
    await writePackage(projectRoot, "examples/echo-tools", createEchoPackageJson(), defaultFiles);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            missing: { enabled: true }
          }
        }
      }
    });

    await expect(loadProjectToolSet(projectRoot)).rejects.toThrow(
      'Tool "missing" is not declared by package "./examples/echo-tools"'
    );
  });

  it("throws clear error for non-existent package in config", async () => {
    const projectRoot = await createTempProject();
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/missing-tools": {
          alias: "missing",
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    await expect(loadProjectToolSet(projectRoot)).rejects.toThrow(
      'Package "./examples/missing-tools" cannot be resolved'
    );
  });

  it("does not expose tools when package is disabled", async () => {
    const projectRoot = await createTempProject();
    await writePackage(projectRoot, "examples/echo-tools", createEchoPackageJson(), defaultFiles);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          enabled: false,
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    const projectToolSet = await loadProjectToolSet(projectRoot);
    expect(projectToolSet.tools).toHaveLength(0);
  });

  it("does not expose tools when tool is disabled in project config", async () => {
    const projectRoot = await createTempProject();
    await writePackage(projectRoot, "examples/echo-tools", createEchoPackageJson(), defaultFiles);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: { enabled: false }
          }
        }
      }
    });

    const projectToolSet = await loadProjectToolSet(projectRoot);
    expect(projectToolSet.tools).toHaveLength(0);
  });

  it("does not expose tools when package target mcp is disabled", async () => {
    const projectRoot = await createTempProject();
    await writePackage(projectRoot, "examples/echo-tools", createEchoPackageJson(), defaultFiles);
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          targets: {
            mcp: {
              enabled: false
            }
          },
          tools: {
            echo: { enabled: true }
          }
        }
      }
    });

    const projectToolSet = await loadProjectToolSet(projectRoot);
    expect(projectToolSet.tools).toHaveLength(0);
  });

  it("does not expose package-default disabled tool unless project explicitly enables it", async () => {
    const projectRoot = await createTempProject();
    await writePackage(
      projectRoot,
      "examples/echo-tools",
      createEchoPackageJson({ enabled: false }),
      defaultFiles
    );
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: {}
          }
        }
      }
    });

    const hiddenSet = await loadProjectToolSet(projectRoot);
    expect(hiddenSet.tools).toHaveLength(0);

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

    const enabledSet = await loadProjectToolSet(projectRoot);
    expect(enabledSet.tools).toHaveLength(1);
  });

  it("does not expose package-default mcp-disabled tool unless project explicitly enables it", async () => {
    const projectRoot = await createTempProject();
    await writePackage(
      projectRoot,
      "examples/echo-tools",
      createEchoPackageJson({
        targets: {
          mcp: {
            enabled: false
          }
        }
      }),
      defaultFiles
    );
    await writeProjectConfig(projectRoot, {
      version: "0.1",
      packages: {
        "./examples/echo-tools": {
          alias: "echo",
          tools: {
            echo: {}
          }
        }
      }
    });

    const hiddenSet = await loadProjectToolSet(projectRoot);
    expect(hiddenSet.tools).toHaveLength(0);

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

    const enabledSet = await loadProjectToolSet(projectRoot);
    expect(enabledSet.tools).toHaveLength(1);
  });
});
