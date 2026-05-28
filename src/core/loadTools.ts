import { z } from "zod";
import type { ToolDefinition, ToolbridgeManifest } from "./types.js";

const toolTargetConfigSchema = z.object({
  enabled: z.boolean().optional()
});

const toolTargetsSchema = z.object({
  mcp: toolTargetConfigSchema.optional()
});

export const toolDefinitionSchema = z.object({
  entry: z.string().min(1, "Must be a non-empty string"),
  description: z.string().trim().min(1, "Must be a non-empty string"),
  inputSchema: z.string().min(1, "Must be a non-empty string"),
  enabled: z.boolean().optional(),
  targets: toolTargetsSchema.optional()
});

export const manifestSchema = z.object({
  version: z.literal("0.1"),
  tools: z
    .record(z.string().min(1), toolDefinitionSchema)
    .refine((tools) => Object.keys(tools).length > 0, {
      message: "Must declare at least one tool"
    })
});

export function loadTools(manifest: unknown): Record<string, ToolbridgeManifest["tools"][string]> {
  const parsed = manifestSchema.parse(manifest);
  return parsed.tools;
}

export function isToolEnabledByDefault(tool: ToolDefinition): boolean {
  return tool.enabled !== false;
}

export function isToolTargetEnabledByDefault(tool: ToolDefinition, target: "mcp"): boolean {
  if (target === "mcp") {
    return tool.targets?.mcp?.enabled !== false;
  }
  return true;
}
