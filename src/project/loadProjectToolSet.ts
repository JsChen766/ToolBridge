import { readFile } from "node:fs/promises";
import path from "node:path";
import { executeToolByName } from "../core/executeTool.js";
import { isToolEnabledByDefault, isToolTargetEnabledByDefault, loadTools } from "../core/loadTools.js";
import { readManifest } from "../core/readManifest.js";
import { validateManifest } from "../core/validateManifest.js";
import { readProjectConfig } from "./config.js";

type ObjectSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export interface ProjectTool {
  exposedName: string;
  packageRef: string;
  originalName: string;
  alias: string;
  description: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
}

export interface ProjectToolSet {
  projectRoot: string;
  tools: ProjectTool[];
  execute(exposedName: string, input: unknown): Promise<unknown>;
}

function toSafeSegment(value: string): string {
  const lowered = value.toLowerCase();
  const replaced = lowered.replace(/[^a-z0-9_-]/g, "_").replace(/_+/g, "_");
  return replaced.replace(/^_+|_+$/g, "") || "tool";
}

function toExposedName(alias: string, toolName: string): string {
  return `${toSafeSegment(alias)}_${toSafeSegment(toolName)}`;
}

async function readToolSchema(packageRoot: string, schemaRef: string): Promise<ObjectSchema> {
  const schemaPath = path.resolve(packageRoot, schemaRef);
  const raw = await readFile(schemaPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed) || parsed.type !== "object") {
    throw new Error(`Schema root "type" must be "object": ${schemaRef}`);
  }
  return parsed as ObjectSchema;
}

export async function loadProjectToolSet(projectRoot: string): Promise<ProjectToolSet> {
  const config = await readProjectConfig(projectRoot);
  const tools: ProjectTool[] = [];
  const routeMap = new Map<string, { packageRef: string; originalName: string }>();

  for (const [packageRef, packageConfig] of Object.entries(config.packages)) {
    if (packageConfig.enabled === false) {
      continue;
    }
    if (packageConfig.targets?.mcp?.enabled === false) {
      continue;
    }

    let readResult: Awaited<ReturnType<typeof readManifest>>;
    try {
      readResult = await readManifest(packageRef, projectRoot);
    } catch {
      throw new Error(`Package "${packageRef}" cannot be resolved`);
    }

    const validation = await validateManifest(readResult);
    if (!validation.ok) {
      const formatted = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
      throw new Error(`Invalid manifest for package "${packageRef}":\n${formatted}`);
    }

    const manifest = readResult.manifest;
    if (!manifest) {
      throw new Error(`Package "${packageRef}" has no manifest`);
    }

    const declaredTools = loadTools(manifest);
    const configuredTools = packageConfig.tools ?? {};

    for (const [configuredToolName, configuredTool] of Object.entries(configuredTools)) {
      const declaredTool = declaredTools[configuredToolName];
      if (!declaredTool) {
        throw new Error(`Tool "${configuredToolName}" is not declared by package "${packageRef}"`);
      }

      const explicitEnable = configuredTool.enabled;
      const shouldExpose =
        explicitEnable === true
          ? true
          : explicitEnable === false
            ? false
            : isToolEnabledByDefault(declaredTool) && isToolTargetEnabledByDefault(declaredTool, "mcp");

      if (!shouldExpose) {
        continue;
      }

      const exposedName = toExposedName(packageConfig.alias, configuredToolName);
      if (routeMap.has(exposedName)) {
        throw new Error(`Exposed tool name collision: "${exposedName}"`);
      }

      const inputSchema = await readToolSchema(readResult.packageRoot, declaredTool.inputSchema);
      const outputSchema = declaredTool.outputSchema
        ? await readToolSchema(readResult.packageRoot, declaredTool.outputSchema)
        : undefined;
      routeMap.set(exposedName, { packageRef, originalName: configuredToolName });
      tools.push({
        exposedName,
        packageRef,
        originalName: configuredToolName,
        alias: packageConfig.alias,
        description: declaredTool.description,
        inputSchema,
        outputSchema
      });
    }
  }

  return {
    projectRoot,
    tools,
    async execute(exposedName: string, input: unknown): Promise<unknown> {
      const route = routeMap.get(exposedName);
      if (!route) {
        throw new Error(`Tool "${exposedName}" not found`);
      }
      return await executeToolByName(route.packageRef, route.originalName, input, projectRoot);
    }
  };
}
