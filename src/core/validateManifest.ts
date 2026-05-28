import { access, readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { z } from "zod";
import { parseEntry } from "./loadToolFunction.js";
import type {
  AgentToolsManifest,
  ReadManifestResult,
  ValidationIssue,
  ValidationResult
} from "./types.js";

const toolDefinitionSchema = z.object({
  entry: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.string().min(1).optional()
});

const manifestSchema = z.object({
  version: z.literal("0.1"),
  tools: z.record(z.string().min(1), toolDefinitionSchema)
});

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function validateManifest(
  readResult: ReadManifestResult
): Promise<ValidationResult> {
  const issues: ValidationIssue[] = [];

  if (!readResult.manifest) {
    issues.push({
      path: "agentTools",
      message: "Missing agentTools field in package.json"
    });
    return { ok: false, issues };
  }

  const parsed = manifestSchema.safeParse(readResult.manifest);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      issues.push({
        path: issue.path.join(".") || "agentTools",
        message: issue.message
      });
    }
    return { ok: false, issues };
  }

  const manifest = parsed.data as AgentToolsManifest;
  const ajv = new Ajv2020({ strict: false, allErrors: true });

  for (const [toolName, toolDefinition] of Object.entries(manifest.tools)) {
    try {
      parseEntry(toolDefinition.entry);
    } catch (error) {
      issues.push({
        path: `agentTools.tools.${toolName}.entry`,
        message: (error as Error).message
      });
      continue;
    }

    const [entryFile] = toolDefinition.entry.split("#");
    const entryPath = path.resolve(readResult.packageRoot, entryFile);
    if (!(await fileExists(entryPath))) {
      issues.push({
        path: `agentTools.tools.${toolName}.entry`,
        message: `Entry file does not exist: ${entryFile}`
      });
    }

    if (!toolDefinition.inputSchema) {
      continue;
    }

    const schemaPath = path.resolve(readResult.packageRoot, toolDefinition.inputSchema);
    if (!(await fileExists(schemaPath))) {
      issues.push({
        path: `agentTools.tools.${toolName}.inputSchema`,
        message: `Schema file does not exist: ${toolDefinition.inputSchema}`
      });
      continue;
    }

    try {
      const schemaRaw = await readFile(schemaPath, "utf8");
      const schemaJson = JSON.parse(schemaRaw) as object;
      ajv.compile(schemaJson);
    } catch (error) {
      issues.push({
        path: `agentTools.tools.${toolName}.inputSchema`,
        message: `Invalid JSON schema: ${(error as Error).message}`
      });
    }
  }

  return {
    ok: issues.length === 0,
    issues
  };
}
