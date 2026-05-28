import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadToolFunction, parseEntry } from "../src/core/loadToolFunction.js";

describe("loadToolFunction", () => {
  it("parses ./tools/echo.js#echo entry format", () => {
    expect(parseEntry("./tools/echo.js#echo")).toEqual({
      modulePath: "./tools/echo.js",
      exportName: "echo"
    });
  });

  it("loads the function from entry and executes it", async () => {
    const packageRoot = path.resolve("examples", "echo-tools");
    const handler = await loadToolFunction(packageRoot, "./tools/echo.js#echo");
    const result = await handler({ message: "hello" });

    expect(result).toEqual({ message: "hello" });
  });
});
