import path from "node:path";
import { describe, expect, it } from "vitest";
import { executeToolByName } from "../src/core/executeTool.js";
import { loadToolFunction, parseEntry } from "../src/core/loadToolFunction.js";

describe("tool execution", () => {
  it('executeToolByName returns { message: "hello" } for echo', async () => {
    const result = await executeToolByName(path.join("examples", "echo-tools"), "echo", {
      message: "hello"
    });

    expect(result).toEqual({ message: "hello" });
  });

  it("throws input validation error when input does not match schema", async () => {
    await expect(executeToolByName(path.join("examples", "echo-tools"), "echo", {})).rejects.toThrow(
      /Input schema validation failed/
    );
  });

  it('throws when tool name does not exist', async () => {
    await expect(
      executeToolByName(path.join("examples", "echo-tools"), "does-not-exist", { message: "hello" })
    ).rejects.toThrow('Tool "does-not-exist" not found');
  });

  it("loadToolFunction loads ./tools/echo.js#echo", async () => {
    const handler = await loadToolFunction(path.resolve("examples", "echo-tools"), "./tools/echo.js#echo");
    const result = await handler({ message: "hello" });

    expect(result).toEqual({ message: "hello" });
  });

  it("parseEntry throws for invalid entry", () => {
    expect(() => parseEntry("./tools/echo.js")).toThrow(/Invalid entry format/);
  });
});
