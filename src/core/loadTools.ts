import { z } from "zod";
import type { AgentToolsManifest } from "./types.js";

export const toolDefinitionSchema = z.object({
  entry: z.string().min(1, "Must be a non-empty string"),
  description: z.string().trim().min(1, "Must be a non-empty string"),
  inputSchema: z.string().min(1, "Must be a non-empty string")
});

export const manifestSchema = z.object({
  version: z.literal("0.1"),
  tools: z
    .record(z.string().min(1), toolDefinitionSchema)
    .refine((tools) => Object.keys(tools).length > 0, {
      message: "Must declare at least one tool"
    })
});

export function loadTools(manifest: unknown): Record<string, AgentToolsManifest["tools"][string]> {
  const parsed = manifestSchema.parse(manifest);
  return parsed.tools;
}
