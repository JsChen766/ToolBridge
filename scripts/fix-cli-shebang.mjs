import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cliPath = path.resolve(__dirname, "..", "dist", "cli.js");
const shebang = "#!/usr/bin/env node";

const source = await readFile(cliPath, "utf8");
const lines = source.split("\n");

if (lines[0] !== shebang) {
  await writeFile(cliPath, `${shebang}\n${source}`, "utf8");
  process.exit(0);
}

let index = 1;
while (lines[index] === shebang) {
  index += 1;
}

if (index > 1) {
  const normalized = [shebang, ...lines.slice(index)].join("\n");
  await writeFile(cliPath, normalized, "utf8");
}
