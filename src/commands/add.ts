import path from "node:path";
import { isToolEnabledByDefault, isToolTargetEnabledByDefault, loadTools } from "../core/loadTools.js";
import { readManifest } from "../core/readManifest.js";
import { validateManifest } from "../core/validateManifest.js";
import {
  getProjectConfigPath,
  projectConfigExists,
  readProjectConfig,
  resolveProjectRoot,
  writeProjectConfig
} from "../project/config.js";

interface AddOptions {
  project?: string;
}

function toAlias(value: string): string {
  const scoped = value.startsWith("@") ? value.slice(1).replace("/", "-") : value;
  const normalized = scoped.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
  const withoutToolsSuffix = normalized.replace(/[-_]tools$/, "");
  return withoutToolsSuffix || normalized;
}

function parsePackageSpecifier(specifier: string): { packageRef: string; toolName?: string } {
  const windowsAbsolutePath = /^[A-Za-z]:[\\/]/.test(specifier);
  if (windowsAbsolutePath) {
    const extraColon = specifier.indexOf(":", 2);
    if (extraColon >= 0) {
      throw new Error(
        'Windows absolute path with ":tool" suffix is not supported. Use a relative path or npm package name.'
      );
    }
    return { packageRef: specifier };
  }

  const splitIndex = specifier.lastIndexOf(":");
  if (splitIndex <= 0 || splitIndex === specifier.length - 1) {
    return { packageRef: specifier };
  }

  return {
    packageRef: specifier.slice(0, splitIndex),
    toolName: specifier.slice(splitIndex + 1)
  };
}

export async function addCommand(specifier: string, options: AddOptions = {}): Promise<void> {
  const projectRoot = resolveProjectRoot(options.project);
  if (!(await projectConfigExists(projectRoot))) {
    throw new Error(`Project config not found. Run "toolbridge init" first in ${projectRoot}`);
  }

  const config = await readProjectConfig(projectRoot);
  const { packageRef, toolName } = parsePackageSpecifier(specifier);
  const readResult = await readManifest(packageRef, projectRoot);
  const validation = await validateManifest(readResult);

  if (!validation.ok) {
    const details = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
    throw new Error(`Manifest validation failed for "${packageRef}":\n${details}`);
  }

  const manifest = readResult.manifest;
  if (!manifest) {
    throw new Error(`No manifest found for package "${packageRef}"`);
  }

  const declaredTools = loadTools(manifest);
  const requestedTools = toolName ? [toolName] : Object.keys(declaredTools);
  const toolsToEnable: string[] = [];

  for (const requestedTool of requestedTools) {
    const declared = declaredTools[requestedTool];
    if (!declared) {
      throw new Error(`Tool "${requestedTool}" is not declared by package "${packageRef}"`);
    }

    if (toolName) {
      toolsToEnable.push(requestedTool);
      continue;
    }

    if (isToolEnabledByDefault(declared) && isToolTargetEnabledByDefault(declared, "mcp")) {
      toolsToEnable.push(requestedTool);
    }
  }

  const defaultAlias = toAlias(readResult.packageJson.name ?? path.basename(readResult.packageRoot));
  const packageConfig = config.packages[packageRef] ?? {
    alias: defaultAlias,
    enabled: true,
    targets: {
      mcp: {
        enabled: true
      }
    },
    tools: {}
  };

  packageConfig.alias = packageConfig.alias || defaultAlias;
  packageConfig.tools = packageConfig.tools ?? {};
  for (const name of toolsToEnable) {
    packageConfig.tools[name] = { enabled: true };
  }

  config.packages[packageRef] = packageConfig;
  await writeProjectConfig(projectRoot, config);

  const configPath = getProjectConfigPath(projectRoot);
  if (toolsToEnable.length === 0) {
    console.log(`Updated ${configPath}. No default-enabled MCP tools found in ${packageRef}.`);
    return;
  }

  console.log(`Updated ${configPath}`);
  console.log(`Package: ${packageRef}`);
  console.log(`Alias: ${packageConfig.alias}`);
  console.log(`Enabled tools: ${toolsToEnable.join(", ")}`);
}
