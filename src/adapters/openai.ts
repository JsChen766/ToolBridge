import { loadProjectToolSet } from "../project/loadProjectToolSet.js";
import { resolveProjectRoot } from "../project/config.js";

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface OpenAIToolCall {
  id?: string;
  type?: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAIToolSet {
  projectRoot: string;
  tools: OpenAITool[];
  executeToolCall(toolCall: OpenAIToolCall): Promise<unknown>;
  execute(name: string, input: unknown): Promise<unknown>;
}

interface OpenAIAdapterOptions {
  projectRoot?: string;
}

function parseToolName(toolCall: OpenAIToolCall): string {
  const name = toolCall?.function?.name;
  if (typeof name !== "string" || name.trim().length === 0) {
    throw new Error("Invalid OpenAI tool call: missing function.name");
  }
  return name;
}

function parseArguments(toolName: string, rawArguments: unknown): unknown {
  if (rawArguments === undefined) {
    return {};
  }
  if (typeof rawArguments !== "string") {
    throw new Error(`Invalid OpenAI tool call arguments for "${toolName}": expected string`);
  }

  const normalized = rawArguments.trim();
  if (normalized.length === 0) {
    return {};
  }

  try {
    return JSON.parse(normalized);
  } catch {
    throw new Error(`Invalid OpenAI tool call arguments for "${toolName}": invalid JSON`);
  }
}

export async function createOpenAIToolSet(
  options: OpenAIAdapterOptions = {}
): Promise<OpenAIToolSet> {
  const projectRoot = resolveProjectRoot(options.projectRoot);
  const projectToolSet = await loadProjectToolSet(projectRoot);
  const tools: OpenAITool[] = projectToolSet.tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.exposedName,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));

  return {
    projectRoot: projectToolSet.projectRoot,
    tools,
    async executeToolCall(toolCall: OpenAIToolCall): Promise<unknown> {
      const toolName = parseToolName(toolCall);
      const parsedArguments = parseArguments(toolName, toolCall?.function?.arguments);
      return await projectToolSet.execute(toolName, parsedArguments);
    },
    async execute(name: string, input: unknown): Promise<unknown> {
      return await projectToolSet.execute(name, input);
    }
  };
}
