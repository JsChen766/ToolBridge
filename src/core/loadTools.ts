import { z } from "zod";
import type { AgentToolsManifest } from "./types.js";

const toolDefinitionSchema = z.object({
  entry: z.string().min(1),
  description: z.string().optional(),
  inputSchema: z.string().min(1).optional()
});

const manifestSchema = z.object({
  version: z.literal("0.1"),
  tools: z.record(z.string().min(1), toolDefinitionSchema)
});

export function loadTools(manifest: unknown): Record<string, AgentToolsManifest["tools"][string]> {
  const parsed = manifestSchema.parse(manifest);
  return parsed.tools;
}
