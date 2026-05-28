import { executeToolByName } from "../core/executeTool.js";

function parseJsonInput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON input");
  }
}

export async function runCommand(
  packageRef: string,
  toolName: string,
  rawJsonInput: string
): Promise<void> {
  const input = parseJsonInput(rawJsonInput);
  const result = await executeToolByName(packageRef, toolName, input);
  console.log(JSON.stringify(result, null, 2));
}
