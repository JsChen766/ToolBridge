import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts"
  },
  format: ["esm"],
  clean: true,
  dts: true,
  banner: {
    js: "#!/usr/bin/env node"
  }
});
