import {
  createDefaultProjectConfig,
  getProjectConfigPath,
  projectConfigExists,
  resolveProjectRoot,
  writeProjectConfig
} from "../project/config.js";

interface InitOptions {
  project?: string;
}

export async function initCommand(options: InitOptions = {}): Promise<void> {
  const projectRoot = resolveProjectRoot(options.project);
  const configPath = getProjectConfigPath(projectRoot);

  if (await projectConfigExists(projectRoot)) {
    console.log(`Project config already exists: ${configPath}`);
    return;
  }

  await writeProjectConfig(projectRoot, createDefaultProjectConfig());
  console.log(`Created ${configPath}`);
}
