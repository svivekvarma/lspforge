import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { ClientConfig } from "./index.js";
import consola from "consola";

function getConfigDir(): string {
  // Use XDG_CONFIG_HOME if available, otherwise default to ~/.config
  const configHome = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(configHome, "nvim", "plugin", "lspforge");
}

function getConfigPath(serverName: string): string {
  return join(getConfigDir(), `${serverName}.lua`);
}

/**
 * Configure a server in Neovim using native LSP format (Neovim 0.11+).
 * Writes to ~/.config/nvim/plugin/lspforge/<serverName>.lua
 */
export async function configureNeovim(
  config: ClientConfig,
): Promise<void> {
  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true });

  const configPath = getConfigPath(config.serverName);

  // Convert extensions (e.g., .ts) to Neovim filetypes (e.g., typescript)
  const filetypes = Array.from(new Set(Object.values(config.extensionToLanguage)));

  const luaConfig = `-- _managed_by: lspforge
vim.lsp.config['${config.serverName}'] = {
  cmd = { '${config.binPath}', ${config.args.map(arg => `'${arg}'`).join(", ")} },
  filetypes = { ${filetypes.map(ft => `'${ft}'`).join(", ")} },
}
vim.lsp.enable('${config.serverName}')
`;

  await writeFile(configPath, luaConfig, "utf-8");

  consola.success(`Configured ${config.serverName} in Neovim (Native LSP)`);
}

/**
 * Remove a managed server from Neovim LSP config.
 */
export async function unconfigureNeovim(
  serverName: string,
): Promise<void> {
  const configPath = getConfigPath(serverName);

  try {
    if (existsSync(configPath)) {
      const content = await readFile(configPath, "utf-8");
      if (content.includes("-- _managed_by: lspforge")) {
        await rm(configPath);
      }
    }
  } catch (err) {
    consola.warn(
      `Could not unconfigure ${serverName} from Neovim: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
