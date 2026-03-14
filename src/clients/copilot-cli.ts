import { homedir } from "node:os";
import { join } from "node:path";
import { mergeJsonConfig } from "../utils/json-merge.js";
import { readFile, writeFile } from "node:fs/promises";
import type { ClientConfig } from "./index.js";
import consola from "consola";

function getConfigPath(): string {
  return join(
    process.env.COPILOT_HOME || join(homedir(), ".copilot"),
    "mcp-config.json",
  );
}

/**
 * Configure a server in GitHub Copilot CLI.
 * Writes to ~/.copilot/mcp-config.json
 */
export async function configureCopilotCli(
  config: ClientConfig,
): Promise<void> {
  const configPath = getConfigPath();

  await mergeJsonConfig(configPath, {
    mcpServers: {
      [config.serverName]: {
        _managed_by: "lspforge",
        command: config.binPath,
        args: config.args,
        env: {},
      },
    },
  });

  consola.success(`Configured ${config.serverName} in GitHub Copilot CLI`);
}

/**
 * Remove a managed server from Copilot CLI config.
 */
export async function unconfigureCopilotCli(
  serverName: string,
): Promise<void> {
  const configPath = getConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content);
    if (config.mcpServers?.[serverName]?._managed_by === "lspforge") {
      delete config.mcpServers[serverName];
      await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
    }
  } catch {
    // Config doesn't exist or is invalid
  }
}
