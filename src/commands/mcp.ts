import { startStdioServer } from "../mcp/stdioServer.js";

export async function mcpCommand(packageRef: string): Promise<void> {
  await startStdioServer(packageRef);
}
