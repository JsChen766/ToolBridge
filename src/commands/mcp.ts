import { resolveProjectRoot } from "../project/config.js";
import { startProjectStdioServer, startStdioServer } from "../mcp/stdioServer.js";

interface McpOptions {
  project?: string;
}

export async function mcpCommand(packageRef?: string, options: McpOptions = {}): Promise<void> {
  if (options.project) {
    await startProjectStdioServer(resolveProjectRoot(options.project));
    return;
  }

  if (!packageRef) {
    throw new Error('Missing package. Use "toolbridge mcp <package>" or "toolbridge mcp --project ."');
  }

  await startStdioServer(packageRef);
}
