import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/tools/echo.ts"],
  format: ["esm"],
  outDir: "dist/tools",
  clean: true,
  dts: false
});
