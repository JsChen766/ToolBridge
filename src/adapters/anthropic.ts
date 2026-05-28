import { loadProjectToolSet } from "../project/loadProjectToolSet.js";
import { resolveProjectRoot } from "../project/config.js";

export interface AnthropicTool {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface AnthropicToolUse {
  id?: string;
  name: string;
  input: unknown;
}

export interface AnthropicToolSet {
  projectRoot: string;
  tools: AnthropicTool[];
  executeToolUse(toolUse: AnthropicToolUse): Promise<unknown>;
  execute(name: string, input: unknown): Promise<unknown>;
}

interface AnthropicAdapterOptions {
  projectRoot?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeInput(toolName: string, input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) {
    return {};
  }
  if (!isPlainObject(input)) {
    throw new Error(`Invalid Anthropic tool input for "${toolName}"`);
  }
  return input;
}

export async function createAnthropicToolSet(
  options: AnthropicAdapterOptions = {}
): Promise<AnthropicToolSet> {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const projectToolSet = await loadProjectToolSet(projectRoot);
  const tools: AnthropicTool[] = projectToolSet.tools.map((tool) => ({
    name: tool.exposedName,
    description: tool.description,
    input_schema: tool.inputSchema
  }));

  return {
    projectRoot: projectToolSet.projectRoot,
    tools,
    async executeToolUse(toolUse: AnthropicToolUse): Promise<unknown> {
      const toolName = toolUse?.name;
      if (!toolName) {
        throw new Error('Invalid Anthropic tool input for "unknown"');
      }
      const input = normalizeInput(toolName, toolUse.input);
      return await projectToolSet.execute(toolName, input);
    },
    async execute(name: string, input: unknown): Promise<unknown> {
      return await projectToolSet.execute(name, input);
    }
  };
}
