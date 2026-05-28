#!/usr/bin/env node
import { Command } from "commander";
import { inspectCommand } from "./commands/inspect.js";
import { validateCommand } from "./commands/validate.js";
import { runCommand } from "./commands/run.js";
import { mcpCommand } from "./commands/mcp.js";
import { linkCommand } from "./commands/link.js";
import { initCommand } from "./commands/init.js";
import { addCommand } from "./commands/add.js";

function withCommandErrorHandling(action: (...args: any[]) => Promise<void>) {
  return async (...args: any[]): Promise<void> => {
    try {
      await action(...args);
    } catch (error) {
      console.error((error as Error).message);
      process.exitCode = 1;
    }
  };
}

const program = new Command();

program
  .name("toolbridge")
  .description("One project MCP bridge for selected npm tools")
  .version("0.1.1");

program
  .command("inspect")
  .argument("[package]", "npm package name or local package path")
  .option("--project <path>", "inspect exposed tools from toolbridge.config.json")
  .action(withCommandErrorHandling(inspectCommand));

program
  .command("validate")
  .argument("<package>", "npm package name or local package path")
  .action(withCommandErrorHandling(validateCommand));

program
  .command("run")
  .argument("<package>", "npm package name or local package path")
  .argument("<tool>", "tool name declared in agentTools")
  .argument("<json>", "JSON string input for the tool")
  .action(withCommandErrorHandling(runCommand));

program
  .command("mcp")
  .argument("[package]", "npm package name or local package path (legacy/debug mode)")
  .option("--project <path>", "run project-level MCP bridge from toolbridge.config.json")
  .action(withCommandErrorHandling(mcpCommand));

program
  .command("link")
  .argument("[package]", "npm package name or local package path (legacy/debug mode)")
  .option("--project <path>", "project root for project-level link preview")
  .requiredOption("--target <target>", "target client name, only claude-code")
  .option("--dry-run", "preview command without writing config", false)
  .action(withCommandErrorHandling(linkCommand));

program
  .command("init")
  .option("--project <path>", "project root path")
  .action(withCommandErrorHandling(initCommand));

program
  .command("add")
  .argument("<package>", "npm package name or local package path, supports :tool suffix")
  .option("--project <path>", "project root path")
  .action(withCommandErrorHandling(addCommand));

await program.parseAsync(process.argv);
