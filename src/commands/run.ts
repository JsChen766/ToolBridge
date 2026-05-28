import { executeToolByName } from "../core/executeTool.js";

function toDoubleQuotedString(value: string): string {
  return JSON.stringify(value);
}

function parseRelaxedObjectInput(raw: string): unknown {
  const trimmed = raw.trim();
  if (!(trimmed.startsWith("{") && trimmed.endsWith("}"))) {
    throw new Error("Invalid JSON input");
  }

  const normalizedKeys = trimmed.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)\s*:/g, '$1"$2":');
  const normalizedQuotedStrings = normalizedKeys.replace(/:\s*'([^']*)'/g, (_match, value: string) => {
    return `:${toDoubleQuotedString(value)}`;
  });
  const normalizedBarewords = normalizedQuotedStrings.replace(
    /:\s*([A-Za-z_$][\w$-]*)\s*([,}])/g,
    (_match, value: string, suffix: string) => {
      if (value === "true" || value === "false" || value === "null") {
        return `:${value}${suffix}`;
      }
      return `:${toDoubleQuotedString(value)}${suffix}`;
    }
  );

  return JSON.parse(normalizedBarewords);
}

function parseJsonInput(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return parseRelaxedObjectInput(raw);
    } catch {
      throw new Error("Invalid JSON input");
    }
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
