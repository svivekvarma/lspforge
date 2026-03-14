import { defineCommand } from "citty";
import consola from "consola";
import { loadPackage, listPackages } from "../core/registry.js";
import { detectPlatform, detectRuntimes } from "../core/platform.js";
import { getServerDir, ensureDataDirs } from "../core/paths.js";
import { addServer, getServer } from "../core/state.js";
import { selectInstaller } from "../installers/index.js";
import { detectClients } from "../clients/index.js";
import { checkLspHealth } from "../health/lsp-check.js";

export interface InstallOptions {
  skipConfig?: boolean;
  skipHealth?: boolean;
}

/**
 * Core install pipeline — shared between `install` command and interactive list.
 * Returns true on success, false on failure.
 */
export async function installServer(
  serverName: string,
  options: InstallOptions = {},
): Promise<boolean> {
  // Check if already installed
  const existing = await getServer(serverName);
  if (existing) {
    consola.warn(`${serverName} is already installed (${existing.version})`);
    consola.info("Use 'lspforge uninstall' first to reinstall");
    return false;
  }

  // Load from registry
  consola.start(`Looking up ${serverName} in registry...`);
  const pkg = await loadPackage(serverName);
  if (!pkg) {
    consola.error(`Server "${serverName}" not found in registry`);
    const available = await listPackages();
    if (available.length > 0) {
      consola.info(`Available servers: ${available.join(", ")}`);
    }
    return false;
  }

  // Detect platform and runtimes
  const platformInfo = detectPlatform();
  const runtimes = await detectRuntimes();

  // Select installer
  const selected = selectInstaller(pkg.source, runtimes);
  if (!selected) {
    consola.error(
      `No compatible installer found for ${serverName}. Required runtimes not available on PATH.`,
    );
    const needed = Object.keys(pkg.source).join(", ");
    consola.info(`Server supports: ${needed}`);
    return false;
  }

  // Install
  consola.start(`Installing ${serverName} via ${selected.type}...`);
  await ensureDataDirs();
  const installDir = getServerDir(serverName);

  let result;
  try {
    result = await selected.installer(pkg, installDir, platformInfo);
  } catch (err) {
    consola.error(
      `Installation failed: ${err instanceof Error ? err.message : err}`,
    );
    return false;
  }

  consola.success(
    `Installed ${serverName} v${result.version} via ${result.source}`,
  );

  // Health check
  if (!options.skipHealth) {
    consola.start("Running health check...");
    const health = await checkLspHealth(
      serverName,
      result.binPath,
      pkg.lsp.args,
      pkg.health?.timeout_ms,
      installDir,
    );

    if (health.status === "ok") {
      consola.success(`Health check passed (${health.responseTimeMs}ms)`);
    } else {
      consola.warn(`Health check ${health.status}: ${health.error}`);
    }

    await addServer(serverName, {
      version: result.version,
      source: result.source,
      installPath: installDir,
      binPath: result.binPath,
      installedAt: new Date().toISOString(),
      healthStatus: health.status === "ok" ? "ok" : "error",
    });
  } else {
    await addServer(serverName, {
      version: result.version,
      source: result.source,
      installPath: installDir,
      binPath: result.binPath,
      installedAt: new Date().toISOString(),
      healthStatus: "unknown",
    });
  }

  // Configure clients
  if (!options.skipConfig) {
    const clients = await detectClients();
    if (clients.length === 0) {
      consola.info(
        "No AI coding tools detected. Use --skip-config or install Claude Code, Copilot CLI, or Codex.",
      );
    } else {
      for (const { name, client } of clients) {
        try {
          await client.configure({
            serverName,
            binPath: result.binPath,
            args: pkg.lsp.args,
            extensionToLanguage: pkg.lsp.extension_to_language,
          });
        } catch (err) {
          consola.warn(
            `Failed to configure ${name}: ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
  }

  return true;
}

export const installCommand = defineCommand({
  meta: {
    name: "install",
    description: "Install an LSP server",
  },
  args: {
    server: {
      type: "positional",
      description: "Server name (e.g., pyright, rust-analyzer)",
      required: true,
    },
    "skip-config": {
      type: "boolean",
      description: "Skip configuring AI tool clients",
      default: false,
    },
    "skip-health": {
      type: "boolean",
      description: "Skip health check after install",
      default: false,
    },
  },
  async run({ args }) {
    const success = await installServer(args.server as string, {
      skipConfig: args["skip-config"],
      skipHealth: args["skip-health"],
    });
    if (!success) {
      process.exitCode = 1;
    }
  },
});
