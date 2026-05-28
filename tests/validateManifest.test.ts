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
});
