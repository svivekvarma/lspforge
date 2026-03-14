import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { ClientConfig } from "./index.js";
import consola from "consola";

/**
 * Get the lspforge plugin directory for Claude Code.
 * Claude Code plugins live in ~/.claude/plugins/cache/ but user-installed
 * plugins are registered in ~/.claude/settings.json. We create a plugin
 * directory at ~/.claude/plugins/lspforge/ and manage .lsp.json within it.
 */
function getPluginDir(): string {
  return join(homedir(), ".claude", "plugins", "lspforge");
}

function getLspConfigPath(): string {
  return join(getPluginDir(), ".lsp.json");
}

function getPluginManifestPath(): string {
  return join(getPluginDir(), ".claude-plugin", "plugin.json");
}

/**
 * Ensure the lspforge plugin directory and manifest exist.
 */
async function ensurePluginDir(): Promise<void> {
  const pluginDir = getPluginDir();
  const manifestDir = join(pluginDir, ".claude-plugin");
  await mkdir(manifestDir, { recursive: true });

  const manifestPath = getPluginManifestPath();
  if (!existsSync(manifestPath)) {
    await writeFile(
      manifestPath,
      JSON.stringify(
        {
          name: "lspforge",
          version: "1.0.0",
          description:
            "LSP servers managed by lspforge — do not edit manually",
          lspServers: "./.lsp.json",
        },
        null,
        2,
      ) + "\n",
      "utf-8",
    );
  }
}

/**
 * Load the current .lsp.json config, or empty object if not present.
 */
async function loadLspConfig(): Promise<Record<string, unknown>> {
  const configPath = getLspConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return {};
  }
}

/**
 * Save the .lsp.json config.
 */
async function saveLspConfig(
  config: Record<string, unknown>,
): Promise<void> {
  await writeFile(
    getLspConfigPath(),
    JSON.stringify(config, null, 2) + "\n",
    "utf-8",
  );
}

/**
 * Configure a server in Claude Code using native LSP plugin system.
 * Writes to ~/.claude/plugins/lspforge/.lsp.json
 */
export async function configureClaudeCode(
  config: ClientConfig,
): Promise<void> {
  await ensurePluginDir();

  const lspConfig = await loadLspConfig();
  lspConfig[config.serverName] = {
    command: config.binPath,
    args: config.args,
    extensionToLanguage: config.extensionToLanguage,
  };

  await saveLspConfig(lspConfig);
  consola.success(`Configured ${config.serverName} in Claude Code (LSP plugin)`);
}

/**
 * Remove a server from Claude Code LSP plugin config.
 */
export async function unconfigureClaudeCode(
  serverName: string,
): Promise<void> {
  try {
    const lspConfig = await loadLspConfig();
    if (serverName in lspConfig) {
      delete lspConfig[serverName];
      await saveLspConfig(lspConfig);
    }

    // If no servers left, clean up the plugin directory
    if (Object.keys(lspConfig).length === 0) {
      const pluginDir = getPluginDir();
      if (existsSync(pluginDir)) {
        await rm(pluginDir, { recursive: true });
      }
    }
  } catch {
    // Config doesn't exist or is invalid
  }
}
