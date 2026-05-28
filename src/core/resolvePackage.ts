import { access } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import type { ResolvedPackageLocation } from "./types.js";

const require = createRequire(import.meta.url);

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function resolvePackage(
  packageRef: string,
  cwd = process.cwd()
): Promise<ResolvedPackageLocation> {
  const localCandidate = path.resolve(cwd, packageRef);

  if (await exists(localCandidate)) {
    const packageJsonPath = localCandidate.endsWith("package.json")
      ? localCandidate
      : path.join(localCandidate, "package.json");

    if (!(await exists(packageJsonPath))) {
      throw new Error(`Cannot find package.json at: ${packageJsonPath}`);
    }

    return {
      packageRoot: path.dirname(packageJsonPath),
      packageJsonPath
    };
  }

  try {
    const packageJsonPath = require.resolve(`${packageRef}/package.json`, {
      paths: [cwd]
    });
    return {
      packageRoot: path.dirname(packageJsonPath),
      packageJsonPath
    };
  } catch {
    throw new Error(`Cannot resolve package: ${packageRef}`);
  }
}
