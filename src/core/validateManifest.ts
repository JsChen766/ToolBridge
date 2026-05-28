import { access, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { parseEntry } from "./loadToolFunction.js";
import { manifestSchema } from "./loadTools.js";
import type {
  ToolbridgeManifest,
  ReadManifestResult,
  ValidationIssue,
  ValidationResult
} from "./types.js";

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function validateSchemaFile(
  ajv: Ajv2020,
  packageRoot: string,
  manifestPrefix: string,
  toolName: string,
  fieldName: "inputSchema" | "outputSchema",
  schemaRef: string,
  issues: ValidationIssue[]
): Promise<void> {
  const issuePath = `${manifestPrefix}.tools.${toolName}.${fieldName}`;
  const schemaPath = path.resolve(packageRoot, schemaRef);

  if (!(await fileExists(schemaPath))) {
    issues.push({
      path: issuePath,
      message: `Schema file does not exist: ${schemaRef}`
    });
    return;
  }

  try {
    const schemaRaw = await readFile(schemaPath, "utf8");
    const schemaJson = JSON.parse(schemaRaw) as Record<string, unknown>;
    if (
      !schemaJson ||
      typeof schemaJson !== "object" ||
      Array.isArray(schemaJson) ||
      schemaJson.type !== "object"
    ) {
      issues.push({
        path: issuePath,
        message: 'Schema root "type" must be "object"'
      });
      return;
    }
    ajv.compile(schemaJson);
  } catch (error) {
    issues.push({
      path: issuePath,
      message: `Invalid JSON schema: ${(error as Error).message}`
    });
  }
}

export async function validateManifest(
  readResult: ReadManifestResult
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];
  const manifestPrefix = readResult.manifestNamespace ?? "toolbridge";

  if (!readResult.manifest) {
    issues.push({
      path: "toolbridge",
      message: "Missing toolbridge or agentTools field in package.json"
    });
    return { ok: false, issues };
  }

  const parsed = manifestSchema.safeParse(readResult.manifest);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const issuePath = issue.path.join(".");
      issues.push({
        path: issuePath ? `${manifestPrefix}.${issuePath}` : manifestPrefix,
        message: issue.message
      });
    }
    return { ok: false, issues };
  }

  const manifest = parsed.data as ToolbridgeManifest;
  const ajv = new Ajv2020({ strict: false, allErrors: true });

  for (const [toolName, toolDefinition] of Object.entries(manifest.tools)) {
    const entryIssuePath = `${manifestPrefix}.tools.${toolName}.entry`;
    let entryFile = "";
    let exportName = "";

    try {
      const parsedEntry = parseEntry(toolDefinition.entry);
      entryFile = parsedEntry.modulePath;
      exportName = parsedEntry.exportName;
    } catch (error) {
      issues.push({
        path: entryIssuePath,
        message: (error as Error).message
      });
      continue;
    }

    const entryPath = path.resolve(readResult.packageRoot, entryFile);
    if (!(await fileExists(entryPath))) {
      issues.push({
        path: entryIssuePath,
        message: `Entry file does not exist: ${entryFile}`
      });
    } else {
      try {
        const resolvedEntryPath = await realpath(entryPath);
        const moduleUrl = pathToFileURL(resolvedEntryPath).href;
        const moduleExports = (await import(moduleUrl)) as Record<string, unknown>;
        if (!(exportName in moduleExports)) {
          issues.push({
            path: entryIssuePath,
            message: `Entry export "${exportName}" not found in ${entryFile}`
          });
        } else if (typeof moduleExports[exportName] !== "function") {
          issues.push({
            path: entryIssuePath,
            message: `Entry export "${exportName}" is not a function in ${entryFile}`
          });
        }
      } catch (error) {
        issues.push({
          path: entryIssuePath,
          message: `Failed to import entry module ${entryFile}: ${(error as Error).message}`
        });
      }
    }

    await validateSchemaFile(
      ajv,
      readResult.packageRoot,
      manifestPrefix,
      toolName,
      "inputSchema",
      toolDefinition.inputSchema,
      issues
    );

    if (toolDefinition.outputSchema) {
      await validateSchemaFile(
        ajv,
        readResult.packageRoot,
        manifestPrefix,
        toolName,
        "outputSchema",
        toolDefinition.outputSchema,
        issues
      );
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}
