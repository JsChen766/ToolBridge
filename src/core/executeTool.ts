import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { readManifest } from "./readManifest.js";
import { loadToolFunction } from "./loadToolFunction.js";
import { loadTools } from "./loadTools.js";
import { validateManifest } from "./validateManifest.js";

async function validateToolInput(
  packageRoot: string,
  schemaPathRef: string,
  input: unknown
): Promise<void> {
  const schemaPath = path.resolve(packageRoot, schemaPathRef);
  const schemaRaw = await readFile(schemaPath, "utf8");
  const schemaJson = JSON.parse(schemaRaw) as object;
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schemaJson);
  const valid = validate(input);

  if (!valid) {
    const details =
      validate.errors?.map((error) => `${error.instancePath || "/"} ${error.message}`).join("; ") ??
      "Unknown input validation error";
    throw new Error(`Input schema validation failed: ${details}`);
  }
}

export async function executeToolByName(
  packageRef: string,
  toolName: string,
  input: unknown,
  cwd = process.cwd()
): Promise<unknown> {
  const readResult = await readManifest(packageRef, cwd);
  const validation = await validateManifest(readResult);

  if (!validation.ok) {
    const formatted = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
    throw new Error(`Manifest validation failed:\n${formatted}`);
  }

  const manifest = readResult.manifest;
  if (!manifest) {
    throw new Error("Missing agentTools manifest");
  }

  const tools = loadTools(manifest);
  const toolDefinition = tools[toolName];

  if (!toolDefinition) {
    throw new Error(`Tool "${toolName}" not found`);
  }

  await validateToolInput(readResult.packageRoot, toolDefinition.inputSchema, input);
  const handler = await loadToolFunction(readResult.packageRoot, toolDefinition.entry);
  return await handler(input);
}
