import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const TOOLBRIDGE_CONFIG_FILE = "toolbridge.config.json";

const targetConfigSchema = z.object({
  enabled: z.boolean().optional()
});

const packageToolConfigSchema = z.object({
  enabled: z.boolean().optional()
});

const packageConfigSchema = z.object({
  alias: z.string().trim().min(1, "alias is required"),
  enabled: z.boolean().optional(),
  targets: z
    .object({
      mcp: targetConfigSchema.optional()
    })
    .optional(),
  tools: z.record(z.string().min(1), packageToolConfigSchema).optional()
});

export const projectConfigSchema = z.object({
  version: z.literal("0.1"),
  packages: z.record(z.string().min(1), packageConfigSchema)
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;
export type ProjectPackageConfig = z.infer<typeof packageConfigSchema>;

export function createDefaultProjectConfig(): ProjectConfig {
  return {
    version: "0.1",
    packages: {}
  };
}

export function resolveProjectRoot(input?: string): string {
  return path.resolve(input ?? process.cwd());
}

export function getProjectConfigPath(projectRoot: string): string {
  return path.join(projectRoot, TOOLBRIDGE_CONFIG_FILE);
}

export async function projectConfigExists(projectRoot: string): Promise<boolean> {
  const configPath = getProjectConfigPath(projectRoot);
  try {
    await access(configPath);
    return true;
  } catch {
    return false;
  }
}

export async function readProjectConfig(projectRoot: string): Promise<ProjectConfig> {
  const configPath = getProjectConfigPath(projectRoot);
  let raw: string;
  try {
    raw = await readFile(configPath, "utf8");
  } catch {
    throw new Error(`Project config not found: ${configPath}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in ${configPath}`);
  }

  const result = projectConfigSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid project config ${configPath}:\n${details}`);
  }

  return result.data;
}

export async function writeProjectConfig(projectRoot: string, config: ProjectConfig): Promise<void> {
  const result = projectConfigSchema.safeParse(config);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid project config data:\n${details}`);
  }

  const configPath = getProjectConfigPath(projectRoot);
  await writeFile(configPath, `${JSON.stringify(result.data, null, 2)}\n`, "utf8");
}
