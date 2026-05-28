import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadMcpToolDefinitions } from "../src/mcp/stdioServer.js";

describe("MCP tool definitions", () => {
  it("loads MCP tool definitions from examples/echo-tools", async () => {
    const definitions = await loadMcpToolDefinitions(path.join("examples", "echo-tools"));

    expect(definitions).toHaveLength(1);
    expect(definitions[0].name).toBe("echo");
    expect(definitions[0].description.length).toBeGreaterThan(0);
    expect(definitions[0].inputSchema.type).toBe("object");
  });
});
