import path from "node:path";
import { describe, expect, it } from "vitest";
import { executeToolByName } from "../src/core/executeTool.js";

describe("executeToolByName", () => {
  it("runs the example echo tool", async () => {
    const packageRef = path.join("examples", "echo-tools");
    const result = await executeToolByName(packageRef, "echo", {
      message: "hello"
    });

    expect(result).toEqual({ message: "hello" });
  });

  it("rejects invalid input against schema", async () => {
    const packageRef = path.join("examples", "echo-tools");

    await expect(
      executeToolByName(packageRef, "echo", {
        message: 123
      })
    ).rejects.toThrowError(/Input schema validation failed/);
  });
});
