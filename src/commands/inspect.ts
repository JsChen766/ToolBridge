import { readManifest } from "../core/readManifest.js";
import { loadTools } from "../core/loadTools.js";
import { validateManifest } from "../core/validateManifest.js";
import { getProjectConfigPath, resolveProjectRoot } from "../project/config.js";
import { loadProjectToolSet } from "../project/loadProjectToolSet.js";

interface InspectOptions {
  project?: string;
}

async function inspectPackage(packageRef: string): Promise<void> {
  const readResult = await readManifest(packageRef);

  if (!readResult.manifest) {
    throw new Error(`No toolbridge or agentTools manifest found in ${readResult.packageJsonPath}`);
  }

  const validation = await validateManifest(readResult);
  if (!validation.ok) {
    const formatted = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
    throw new Error(
      `Invalid manifest. Run "toolbridge validate ${packageRef}" for details.\n${formatted}`
    );
  }

  const tools = loadTools(readResult.manifest);
  const entries = Object.entries(tools);

  const packageName = readResult.packageJson.name ?? packageRef;

  console.log(`Package: ${packageName}`);
  console.log(`Location: ${readResult.packageRoot}`);
  console.log("");
  console.log("Tools:");
  for (const [name, definition] of entries) {
    console.log(`- ${name}`);
    console.log(`  description: ${definition.description}`);
    console.log(`  entry: ${definition.entry}`);
    console.log(`  inputSchema: ${definition.inputSchema}`);
  }
}

async function inspectProject(projectInput?: string): Promise<void> {
  const projectRoot = resolveProjectRoot(projectInput);
  const configPath = getProjectConfigPath(projectRoot);
  const projectToolSet = await loadProjectToolSet(projectRoot);

  console.log(`Project: ${projectRoot}`);
  console.log(`Config: ${configPath}`);
  console.log("");
  console.log("Exposed tools:");

  if (projectToolSet.tools.length === 0) {
    console.log('No exposed tools. Use "toolbridge add <package>" to enable tools.');
    return;
  }

  for (const tool of projectToolSet.tools) {
    console.log(`- ${tool.exposedName}`);
    console.log(`  package: ${tool.packageRef}`);
    console.log(`  original: ${tool.originalName}`);
    console.log(`  alias: ${tool.alias}`);
    console.log(`  description: ${tool.description}`);
  }
}

export async function inspectCommand(packageRef?: string, options: InspectOptions = {}): Promise<void> {
  if (options.project) {
    await inspectProject(options.project);
    return;
  }

  if (!packageRef) {
    throw new Error('Missing package. Use "toolbridge inspect <package>" or "toolbridge inspect --project ."');
  }

  await inspectPackage(packageRef);
}
