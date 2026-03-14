import { homedir } from "node:os";
import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { parse as parseToml, stringify as stringifyToml } from "smol-toml";
import type { ClientConfig } from "./index.js";
import consola from "consola";

function getConfigPath(): string {
  return join(homedir(), ".codex", "config.toml");
}

/**
 * Configure a server in OpenAI Codex CLI.
 * Writes to ~/.codex/config.toml under [mcp_servers.<name>]
 */
export async function configureCodex(
  config: ClientConfig,
): Promise<void> {
  const configPath = getConfigPath();
  let existing: Record<string, unknown> = {};

  try {
    const content = await readFile(configPath, "utf-8");
    existing = parseToml(content) as Record<string, unknown>;
  } catch {
    // File doesn't exist — start fresh
  }

  // Ensure mcp_servers section exists
  if (!existing.mcp_servers || typeof existing.mcp_servers !== "object") {
    existing.mcp_servers = {};
  }

  const mcpServers = existing.mcp_servers as Record<string, unknown>;
  mcpServers[config.serverName] = {
    _managed_by: "lspforge",
    command: config.binPath,
    args: config.args,
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, stringifyToml(existing) + "\n", "utf-8");

  consola.success(`Configured ${config.serverName} in Codex`);
}

/**
 * Remove a managed server from Codex config.
 */
export async function unconfigureCodex(
  serverName: string,
): Promise<void> {
  const configPath = getConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;
    const mcpServers = config.mcp_servers as
      | Record<string, unknown>
      | undefined;
    if (!mcpServers) return;

    const entry = mcpServers[serverName] as
      | Record<string, unknown>
      | undefined;
    if (entry?._managed_by === "lspforge") {
      delete mcpServers[serverName];
      await writeFile(configPath, stringifyToml(config) + "\n", "utf-8");
    }
  } catch {
    // Config doesn't exist or is invalid
  }
}
