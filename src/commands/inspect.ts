import { readManifest } from "../core/readManifest.js";
import { loadTools } from "../core/loadTools.js";
import { validateManifest } from "../core/validateManifest.js";

export async function inspectCommand(packageRef: string): Promise<void> {
  const readResult = await readManifest(packageRef);

  if (!readResult.manifest) {
    throw new Error(`No agentTools found in ${readResult.packageJsonPath}`);
  }

  const validation = await validateManifest(readResult);
  if (!validation.ok) {
    const formatted = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
    throw new Error(
      `Invalid agentTools manifest. Run "toolbridge validate ${packageRef}" for details.\n${formatted}`
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
