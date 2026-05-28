import { readFile } from "node:fs/promises";
import type { PackageJsonWithAgentTools, ReadManifestResult } from "./types.js";
import { resolvePackage } from "./resolvePackage.js";

export async function readManifest(
  packageRef: string,
  cwd = process.cwd()
): Promise<ReadManifestResult> {
  const { packageRoot, packageJsonPath } = await resolvePackage(packageRef, cwd);
  const raw = await readFile(packageJsonPath, "utf8");

  let packageJson: PackageJsonWithAgentTools;
  try {
    packageJson = JSON.parse(raw) as PackageJsonWithAgentTools;
  } catch {
    throw new Error(`Invalid JSON in ${packageJsonPath}`);
  }

  const hasToolbridge = packageJson.toolbridge !== undefined;
  const hasAgentTools = packageJson.agentTools !== undefined;
  const manifestNamespace = hasToolbridge ? "toolbridge" : hasAgentTools ? "agentTools" : null;
  const rawManifest = hasToolbridge ? packageJson.toolbridge : hasAgentTools ? packageJson.agentTools : null;

  return {
    packageRef,
    packageRoot,
    packageJsonPath,
    packageJson,
    manifest: rawManifest as ReadManifestResult["manifest"],
    manifestNamespace
  };
}
