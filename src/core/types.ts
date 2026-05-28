export type ManifestNamespace = "toolbridge" | "agentTools";

export interface ToolTargetConfig {
  enabled?: boolean;
}

export interface ToolTargets {
  mcp?: ToolTargetConfig;
}

export interface ToolDefinition {
  entry: string;
  description: string;
  inputSchema: string;
  enabled?: boolean;
  targets?: ToolTargets;
}

export interface ToolbridgeManifest {
  version: "0.1";
  tools: Record<string, ToolDefinition>;
}

export interface PackageJsonWithAgentTools {
  name?: string;
  version?: string;
  toolbridge?: unknown;
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
  manifest: ToolbridgeManifest | null;
  manifestNamespace: ManifestNamespace | null;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
}
