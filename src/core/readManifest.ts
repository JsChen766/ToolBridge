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

  return {
    packageRef,
    packageRoot,
    packageJsonPath,
    packageJson,
    manifest: (packageJson.agentTools ?? null) as ReadManifestResult["manifest"]
  };
}
