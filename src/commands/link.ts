import { access } from "node:fs/promises";
import path from "node:path";
import { readManifest } from "../core/readManifest.js";

interface LinkOptions {
  target?: string;
  dryRun?: boolean;
}

async function exists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function toSafeName(raw: string): string {
  const scoped = raw.startsWith("@") ? raw.slice(1).replace("/", "-") : raw;
  const normalized = scoped.toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  return normalized.replace(/-+/g, "-");
}

async function resolveLinkName(packageRef: string, isLocalPath: boolean): Promise<string> {
  if (!isLocalPath) {
    return toSafeName(packageRef);
  }

  try {
    const manifest = await readManifest(packageRef);
    if (manifest.packageJson.name) {
      return toSafeName(manifest.packageJson.name);
    }
  } catch {
    // Fall back to path basename when package.json cannot be read.
  }

  return toSafeName(path.basename(path.resolve(packageRef)));
}

export async function linkCommand(packageRef: string, options: LinkOptions): Promise<void> {
  if (options.target !== "claude-code") {
    throw new Error('Only "--target claude-code" is supported in v0.1-alpha');
  }

  if (!options.dryRun) {
    throw new Error('Only "--dry-run" is supported in v0.1-alpha');
  }

  const localCandidate = path.resolve(packageRef);
  const isLocalPath = await exists(localCandidate);
  const safeName = await resolveLinkName(packageRef, isLocalPath);

  if (isLocalPath) {
    const cliPath = path.resolve("dist", "cli.js");
    const packagePath = localCandidate;
    console.log(`claude mcp add ${safeName} -- node ${cliPath} mcp ${packagePath}`);
    return;
  }

  console.log(`claude mcp add ${safeName} -- npx -y toolbridge mcp ${packageRef}`);
}
