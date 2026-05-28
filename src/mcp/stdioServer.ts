import { readFile } from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { executeToolByName } from "../core/executeTool.js";
import { loadTools } from "../core/loadTools.js";
import { readManifest } from "../core/readManifest.js";
import { validateManifest } from "../core/validateManifest.js";

type ObjectSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

async function readToolInputSchema(packageRoot: string, inputSchemaRef: string): Promise<ObjectSchema> {
  const schemaPath = path.resolve(packageRoot, inputSchemaRef);
  const raw = await readFile(schemaPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (parsed.type !== "object") {
    throw new Error(`Schema root "type" must be "object": ${inputSchemaRef}`);
  }

  return parsed as ObjectSchema;
}

export async function startStdioServer(packageRef: string): Promise<void> {
  const readResult = await readManifest(packageRef);
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
  const toolSchemas = new Map<string, ObjectSchema>();

  for (const [toolName, definition] of Object.entries(tools)) {
    const schema = await readToolInputSchema(readResult.packageRoot, definition.inputSchema);
    toolSchemas.set(toolName, schema);
  }

  const server = new Server(
    { name: `toolbridge:${readResult.packageJson.name ?? "package"}`, version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: Object.entries(tools).map(([name, definition]) => ({
        name,
        description: definition.description,
        inputSchema: toolSchemas.get(name) as ObjectSchema
      }))
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    if (!tools[toolName]) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${toolName}` }]
      };
    }

    try {
      const result = await executeToolByName(packageRef, toolName, request.params.arguments ?? {});
      return {
        content: [{ type: "text", text: JSON.stringify(result ?? null, null, 2) }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: (error as Error).message }]
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
