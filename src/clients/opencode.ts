import { join } from "node:path";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { existsSync } from "node:fs";
import type { ClientConfig } from "./index.js";
import consola from "consola";

/**
 * Find the OpenCode/Crush config file.
 * Checks for .crush.json, crush.json, and opencode.json in cwd.
 */
function getConfigPath(): string {
  // Prefer .crush.json if it exists, else crush.json, else opencode.json
  const cwd = process.cwd();
  for (const name of [".crush.json", "crush.json", "opencode.json"]) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  // Default to opencode.json
  return join(cwd, "opencode.json");
}

/**
 * Configure a server in OpenCode/Crush.
 * Writes to opencode.json (or .crush.json) with native LSP config.
 */
export async function configureOpenCode(
  config: ClientConfig,
): Promise<void> {
  const configPath = getConfigPath();
  let existing: Record<string, unknown> = {};

  try {
    const content = await readFile(configPath, "utf-8");
    existing = JSON.parse(content);
  } catch {
    // File doesn't exist — start fresh
  }

  // Ensure lsp section exists
  if (!existing.lsp || typeof existing.lsp !== "object") {
    existing.lsp = {};
  }

  const lsp = existing.lsp as Record<string, unknown>;
  lsp[config.serverName] = {
    _managed_by: "lspforge",
    command: config.binPath,
    args: config.args,
    extensions: Object.keys(config.extensionToLanguage),
  };

  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(
    configPath,
    JSON.stringify(existing, null, 2) + "\n",
    "utf-8",
  );

  consola.success(`Configured ${config.serverName} in OpenCode`);
}

/**
 * Remove a managed server from OpenCode/Crush config.
 */
export async function unconfigureOpenCode(
  serverName: string,
): Promise<void> {
  const configPath = getConfigPath();
  try {
    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content);
    const lsp = config.lsp as Record<string, unknown> | undefined;
    if (!lsp) return;

    const entry = lsp[serverName] as Record<string, unknown> | undefined;
    if (entry?._managed_by === "lspforge") {
      delete lsp[serverName];
      await writeFile(
        configPath,
        JSON.stringify(config, null, 2) + "\n",
        "utf-8",
      );
    }
  } catch {
    // Config doesn't exist or is invalid
  }
}
