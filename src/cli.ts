import { Command } from "commander";
import { inspectCommand } from "./commands/inspect.js";
import { validateCommand } from "./commands/validate.js";
import { runCommand } from "./commands/run.js";
import { mcpCommand } from "./commands/mcp.js";
import { linkCommand } from "./commands/link.js";

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
  .description("Load agentTools from npm packages")
  .version("0.1.0");

program
  .command("inspect")
  .argument("<package>", "npm package name or local package path")
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
  .argument("<package>", "npm package name or local package path")
  .action(withCommandErrorHandling(mcpCommand));

program
  .command("link")
  .argument("<package>", "npm package name or local package path")
  .requiredOption("--target <target>", "target client name, only claude-code")
  .option("--dry-run", "preview command without writing config", false)
  .action(withCommandErrorHandling(linkCommand));

await program.parseAsync(process.argv);
