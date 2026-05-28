import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { linkCommand } from "../src/commands/link.js";

const tempDirs: string[] = [];

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "toolbridge-link-"));
  tempDirs.push(dir);
  return dir;
}

async function createLocalPackage(packageRoot: string): Promise<void> {
  await mkdir(packageRoot, { recursive: true });
  await writeFile(
    path.join(packageRoot, "package.json"),
    JSON.stringify({
      name: "echo-tools",
      version: "0.1.0",
      type: "module",
      toolbridge: {
        version: "0.1",
        tools: {
          echo: {
            entry: "./tools/echo.js#echo",
            description: "Echo",
            inputSchema: "./schemas/echo.input.json"
          }
        }
      }
    }),
    "utf8"
  );
}

afterEach(async () => {
  vi.restoreAllMocks();
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      await rm(dir, { recursive: true, force: true });
    }
  }
});

describe("link command output", () => {
  it("quotes cli path and project path in project mode", async () => {
    const projectRoot = await createTempDir();
    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.join(" "));
    });

    await linkCommand(undefined, {
      target: "claude-code",
      dryRun: true,
      project: projectRoot
    });

    const output = lines.join("\n");
    const cliPath = path.resolve("dist", "cli.js");
    expect(output).toContain(`node "${cliPath}" mcp --project "${path.resolve(projectRoot)}"`);
  });

  it("quotes cli path and local package path in legacy local package mode", async () => {
    const projectRoot = await createTempDir();
    const packageRoot = path.join(projectRoot, "examples", "echo tools");
    await createLocalPackage(packageRoot);

    const lines: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      lines.push(args.join(" "));
    });

    await linkCommand(packageRoot, {
      target: "claude-code",
      dryRun: true
    });

    const output = lines.join("\n");
    const cliPath = path.resolve("dist", "cli.js");
    expect(output).toContain(`node "${cliPath}" mcp "${path.resolve(packageRoot)}"`);
  });
});
