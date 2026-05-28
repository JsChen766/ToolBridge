import { readManifest } from "../core/readManifest.js";
import { validateManifest } from "../core/validateManifest.js";

export async function validateCommand(packageRef: string): Promise<void> {
  const readResult = await readManifest(packageRef);
  const result = await validateManifest(readResult);

  if (result.ok) {
    console.log(`Valid manifest in ${readResult.packageJsonPath}`);
    return;
  }

  for (const issue of result.issues) {
    console.error(`- ${issue.path}: ${issue.message}`);
  }

  throw new Error("Manifest validation failed");
}
