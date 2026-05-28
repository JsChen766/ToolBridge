import { readManifest } from "../core/readManifest.js";
import { loadTools } from "../core/loadTools.js";

export async function inspectCommand(packageRef: string): Promise<void> {
  const readResult = await readManifest(packageRef);

  if (!readResult.manifest) {
    throw new Error(`No agentTools found in ${readResult.packageJsonPath}`);
  }

  const tools = loadTools(readResult.manifest);
  const entries = Object.entries(tools);

  if (entries.length === 0) {
    console.log(`No tools declared in ${packageRef}`);
    return;
  }

  for (const [name, definition] of entries) {
    const description = definition.description ?? "(no description)";
    console.log(`${name}\n  entry: ${definition.entry}\n  description: ${description}`);
  }
}
