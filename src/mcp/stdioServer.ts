import { readFile } from "node:fs/promises";
import path from "node:path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { executeToolByName } from "../core/executeTool.js";
import { isToolEnabledByDefault, isToolTargetEnabledByDefault, loadTools } from "../core/loadTools.js";
import { readManifest } from "../core/readManifest.js";
import { validateManifest } from "../core/validateManifest.js";
import { loadProjectToolSet } from "../project/loadProjectToolSet.js";

type ObjectSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
};

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: ObjectSchema;
}

async function readToolInputSchema(packageRoot: string, inputSchemaRef: string): Promise<ObjectSchema> {
  const schemaPath = path.resolve(packageRoot, inputSchemaRef);
  const raw = await readFile(schemaPath, "utf8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  if (parsed.type !== "object") {
    throw new Error(`Schema root "type" must be "object": ${inputSchemaRef}`);
  }

  return parsed as ObjectSchema;
}

export async function loadMcpToolDefinitions(packageRef: string): Promise<McpToolDefinition[]> {
  const readResult = await readManifest(packageRef);
  const validation = await validateManifest(readResult);

  if (!validation.ok) {
    const formatted = validation.issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n");
    throw new Error(`Manifest validation failed:\n${formatted}`);
  }

  const manifest = readResult.manifest;
  if (!manifest) {
    throw new Error("Missing toolbridge or agentTools manifest");
  }

  const tools = loadTools(manifest);
  const definitions: McpToolDefinition[] = [];

  for (const [name, definition] of Object.entries(tools)) {
    if (!isToolEnabledByDefault(definition) || !isToolTargetEnabledByDefault(definition, "mcp")) {
      continue;
    }

    definitions.push({
      name,
      description: definition.description,
      inputSchema: await readToolInputSchema(readResult.packageRoot, definition.inputSchema)
    });
  }

  return definitions;
}

export async function loadProjectMcpToolDefinitions(projectRoot: string): Promise<McpToolDefinition[]> {
  const projectToolSet = await loadProjectToolSet(projectRoot);
  return projectToolSet.tools.map((tool) => ({
    name: tool.exposedName,
    description: tool.description,
    inputSchema: tool.inputSchema as ObjectSchema
  }));
}

async function startServer(
  definitions: McpToolDefinition[],
  execute: (toolName: string, input: unknown) => Promise<unknown>
): Promise<void> {
  const toolNames = new Set(definitions.map((definition) => definition.name));

  const server = new Server(
    { name: "toolbridge-mcp", version: "0.1.0" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: definitions
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const toolName = request.params.name;
    if (!toolNames.has(toolName)) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              error: {
                message: `Tool "${toolName}" not found`,
                tool: toolName
              }
            })
          }
        ]
      };
    }

    try {
      const result = await execute(toolName, request.params.arguments ?? {});
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: true,
              output: result ?? null
            })
          }
        ]
      };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: JSON.stringify({
              ok: false,
              error: {
                message: (error as Error).message,
                tool: toolName
              }
            })
          }
        ]
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export async function startStdioServer(packageRef: string): Promise<void> {
  const definitions = await loadMcpToolDefinitions(packageRef);
  await startServer(definitions, async (toolName, input) => executeToolByName(packageRef, toolName, input));
}

export async function startProjectStdioServer(projectRoot: string): Promise<void> {
  const projectToolSet = await loadProjectToolSet(projectRoot);
  const definitions = projectToolSet.tools.map((tool) => ({
    name: tool.exposedName,
    description: tool.description,
    inputSchema: tool.inputSchema as ObjectSchema
  }));

  await startServer(definitions, async (toolName, input) => projectToolSet.execute(toolName, input));
}
