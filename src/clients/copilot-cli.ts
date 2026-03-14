import { homedir } from "node:os";
import { join } from "node:path";
import { mergeJsonConfig } from "../utils/json-merge.js";
import { readFile, writeFile } from "node:fs/promises";
import type { ClientConfig } from "./index.js";
import consola from "consola";

function getConfigPath(): string {
  return join(
    process.env.COPILOT_HOME || join(homedir(), ".copilot"),
    "lsp-config.json",
  );
}

/**
 * Configure a server in GitHub Copilot CLI.
 * Writes to ~/.copilot/lsp-config.json using native LSP config format.
 */
export async function configureCopilotCli(
  config: ClientConfig,
): Promise<void> {
  const configPath = getConfigPath();

  await mergeJsonConfig(configPath, {
    lspServers: {
      [config.serverName]: {
        _managed_by: "lspforge",
        command: config.binPath,
        args: config.args,
        fileExtensions: config.extensionToLanguage,
      },
    },
  });

  consola.success(`Configured ${config.serverName} in GitHub Copilot CLI (LSP)`);
}

/**
 * Remove a managed server from Copilot CLI LSP config.
 */
export async function unconfigureCopilotCli(
  serverName: string,
): Promise<void> {
  const configPath = getConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content);
    if (config.lspServers?.[serverName]?._managed_by === "lspforge") {
      delete config.lspServers[serverName];
      await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    }
  } catch {
    // Config doesn't exist or is invalid
  }
}
