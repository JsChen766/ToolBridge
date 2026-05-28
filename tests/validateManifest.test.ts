import path from "node:path";
import { describe, expect, it } from "vitest";
import { readManifest } from "../src/core/readManifest.js";
import { validateManifest } from "../src/core/validateManifest.js";

describe("validateManifest", () => {
  it("accepts the example manifest", async () => {
    const packageRef = path.join("examples", "echo-tools");
    const readResult = await readManifest(packageRef);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it("returns an error when agentTools is missing", async () => {
    const packageRef = path.join("tests", "fixtures", "missing-agent-tools");
    const readResult = await readManifest(packageRef);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "agentTools",
          message: "Missing agentTools field in package.json"
        })
      ])
    );
  });

  it("returns an error when a tool description is missing", async () => {
    const packageRef = path.join("tests", "fixtures", "missing-description");
    const readResult = await readManifest(packageRef);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "agentTools.tools.echo.description",
          message: "Required"
        })
      ])
    );
  });

  it("returns an error when a tool inputSchema is missing", async () => {
    const packageRef = path.join("tests", "fixtures", "missing-input-schema");
    const readResult = await readManifest(packageRef);
    const result = await validateManifest(readResult);

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "agentTools.tools.echo.inputSchema",
          message: "Required"
        })
      ])
    );
  });
});
