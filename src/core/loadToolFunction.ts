import path from "node:path";
import { pathToFileURL } from "node:url";

export interface ParsedEntry {
  modulePath: string;
  exportName: string;
}

export type ToolHandler = (input: unknown) => unknown | Promise<unknown>;

export function parseEntry(entry: string): ParsedEntry {
  const splitIndex = entry.lastIndexOf("#");

  if (splitIndex <= 0 || splitIndex === entry.length - 1) {
    throw new Error(`Invalid entry format: ${entry}. Expected ./file.js#exportName`);
  }

  const modulePath = entry.slice(0, splitIndex);
  const exportName = entry.slice(splitIndex + 1);
  return { modulePath, exportName };
}

export async function loadToolFunction(
  packageRoot: string,
  entry: string
): Promise<ToolHandler> {
  const { modulePath, exportName } = parseEntry(entry);
  const absoluteModulePath = path.resolve(packageRoot, modulePath);
  const moduleUrl = pathToFileURL(absoluteModulePath).href;
  const moduleExports = (await import(moduleUrl)) as Record<string, unknown>;
  const handler = moduleExports[exportName];

  if (typeof handler !== "function") {
    throw new Error(`Export "${exportName}" is not a function in ${modulePath}`);
  }

  return handler as ToolHandler;
}
