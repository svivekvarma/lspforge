import { exec } from "../utils/spawn.js";
import type { ClientConfig } from "./index.js";
import consola from "consola";

/**
 * Configure a server in Claude Code using `claude mcp add`.
 */
export async function configureClaudeCode(
  config: ClientConfig,
): Promise<void> {
  const result = await exec("claude", [
    "mcp",
    "add",
    "--transport",
    "stdio",
    config.serverName,
    "--",
    config.binPath,
    ...config.args,
  ]);

  if (result.code !== 0) {
    throw new Error(`claude mcp add failed: ${result.stderr}`);
  }

  consola.success(`Configured ${config.serverName} in Claude Code`);
}

/**
 * Remove a server from Claude Code using `claude mcp remove`.
 */
export async function unconfigureClaudeCode(
  serverName: string,
): Promise<void> {
  const result = await exec("claude", ["mcp", "remove", serverName]);

  if (result.code !== 0) {
    consola.warn(
      `Could not remove ${serverName} from Claude Code: ${result.stderr}`,
    );
  }
}
