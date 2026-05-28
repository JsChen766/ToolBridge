export interface ToolDefinition {
  entry: string;
  description?: string;
  inputSchema?: string;
}

export interface AgentToolsManifest {
  version: "0.1";
  tools: Record<string, ToolDefinition>;
}

export interface PackageJsonWithAgentTools {
  name?: string;
  version?: string;
  agentTools?: unknown;
}

export interface ResolvedPackageLocation {
  packageRoot: string;
  packageJsonPath: string;
}

export interface ReadManifestResult {
  packageRef: string;
  packageRoot: string;
  packageJsonPath: string;
  packageJson: PackageJsonWithAgentTools;
  manifest: AgentToolsManifest | null;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
