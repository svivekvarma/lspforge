import { join } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { mergeJsonConfig } from "../utils/json-merge.js";
import type { ClientConfig } from "./index.js";
import consola from "consola";

/**
 * Find the OpenCode/Crush config file.
 * Checks for .crush.json, crush.json, and opencode.json in cwd.
 */
function getConfigPath(): string {
  const cwd = process.cwd();
  for (const name of [".crush.json", "crush.json", "opencode.json"]) {
    const candidate = join(cwd, name);
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return join(cwd, "opencode.json");
}

/**
 * Configure a server in OpenCode/Crush.
 * Writes to opencode.json (or .crush.json) with native LSP config.
 * Uses mergeJsonConfig to preserve existing formatting and entries.
 */
export async function configureOpenCode(
  config: ClientConfig,
): Promise<void> {
  const configPath = getConfigPath();

  await mergeJsonConfig(configPath, {
    lsp: {
      [config.serverName]: {
        _managed_by: "lspforge",
        command: config.binPath,
        args: config.args,
        extensions: Object.keys(config.extensionToLanguage),
      },
    },
  });

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
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    if (typeof config !== "object" || config === null || Array.isArray(config)) return;

    const lsp = config.lsp as Record<string, unknown> | undefined;
    if (!lsp) return;

    const entry = lsp[serverName] as Record<string, unknown> | undefined;
    if (entry?._managed_by === "lspforge") {
      delete lsp[serverName];
      // Preserve indent style
      const match = raw.match(/^(\s+)"/m);
      const indent = match?.[1].includes("\t") ? "\t" : (match?.[1].length ?? 2);
      await writeFile(
        configPath,
        JSON.stringify(config, null, indent) + "\n",
        "utf-8",
      );
    }
  } catch {
    // Config doesn't exist or is invalid — nothing to unconfigure
  }
}
