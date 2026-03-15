import { defineCommand } from "citty";
import consola from "consola";
import { loadPackage } from "../core/registry.js";
import { detectPlatform, detectRuntimes } from "../core/platform.js";
import { ensureDataDirs } from "../core/paths.js";
import { addServer, getServer, loadState } from "../core/state.js";
import { selectInstaller } from "../installers/index.js";
import { detectClients } from "../clients/index.js";
import { checkLspHealth } from "../health/lsp-check.js";
import { isNewer } from "../utils/version.js";
import type { PackageDefinition } from "../core/registry.js";
import type { ServerState } from "../core/state.js";

/**
 * Extract the registry version from a package definition for a given source type.
 */
function getRegistryVersion(pkg: PackageDefinition, sourceType: string): string | null {
  if (sourceType === "binary" && pkg.source.github_release) {
    return pkg.source.github_release.tag;
  }
  const src = pkg.source[sourceType as keyof typeof pkg.source] as
    | { version?: string }
    | undefined;
  return src?.version ?? null;
}

interface UpdateResult {
  name: string;
  status: "updated" | "up-to-date" | "error";
  fromVersion?: string;
  toVersion?: string;
  error?: string;
}

/**
 * Update a single server. Returns the result.
 */
async function updateServer(
  serverName: string,
  server: ServerState,
  options: { force?: boolean; check?: boolean },
): Promise<UpdateResult> {
  // Load from registry
  const pkg = await loadPackage(serverName);
  if (!pkg) {
    return { name: serverName, status: "error", error: "not found in registry" };
  }

  const registryVersion = getRegistryVersion(pkg, server.source);
  if (!registryVersion) {
    return { name: serverName, status: "error", error: "no version defined in registry" };
  }

  const needsUpdate = options.force || isNewer(server.version, registryVersion);

  if (!needsUpdate) {
    return {
      name: serverName,
      status: "up-to-date",
      fromVersion: server.version,
      toVersion: registryVersion,
    };
  }

  // Dry run — just report
  if (options.check) {
    return {
      name: serverName,
      status: "updated",
      fromVersion: server.version,
      toVersion: registryVersion,
    };
  }

  // Detect platform and runtimes
  const platformInfo = detectPlatform();
  const runtimes = await detectRuntimes();

  // Select the same installer type that was originally used
  const selected = selectInstaller(pkg.source, runtimes);
  if (!selected || selected.type !== server.source) {
    const reason = !selected
      ? "no compatible installer available"
      : `original installer (${server.source}) is no longer available, found ${selected.type} instead`;
    return { name: serverName, status: "error", error: reason };
  }

  // Install in-place using the stored install path
  const installDir = server.installPath;
  consola.start(`Updating ${serverName} from v${server.version} to v${registryVersion} via ${selected.type}...`);
  await ensureDataDirs();

  let result;
  try {
    result = await selected.installer(pkg, installDir, platformInfo);
  } catch (err) {
    return {
      name: serverName,
      status: "error",
      error: `installation failed: ${err instanceof Error ? err.message : err}`,
    };
  }

  consola.success(`Installed ${serverName} v${result.version} via ${result.source}`);

  // Health check
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

  // Update state
  await addServer(serverName, {
    version: result.version,
    source: result.source,
    installPath: installDir,
    binPath: result.binPath,
    installedAt: new Date().toISOString(),
    healthStatus: health.status === "ok" ? "ok" : "error",
  });

  // Re-configure clients if binPath changed
  if (result.binPath !== server.binPath) {
    const clients = await detectClients();
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
          `Failed to update ${name} config: ${err instanceof Error ? err.message : err}`,
        );
      }
    }
  }

  return {
    name: serverName,
    status: "updated",
    fromVersion: server.version,
    toVersion: result.version,
  };
}

export const updateCommand = defineCommand({
  meta: {
    name: "update",
    description: "Update installed LSP servers to latest registry versions",
  },
  args: {
    server: {
      type: "positional",
      description: "Server to update (omit for all installed servers)",
      required: false,
    },
    check: {
      type: "boolean",
      description: "Show available updates without installing",
      default: false,
    },
    force: {
      type: "boolean",
      description: "Reinstall even if version matches",
      default: false,
    },
  },
  async run({ args }) {
    const serverName = args.server as string | undefined;
    const check = args.check as boolean;
    const force = args.force as boolean;

    let toUpdate: [string, ServerState][];

    if (serverName) {
      const server = await getServer(serverName);
      if (!server) {
        consola.error(`${serverName} is not installed`);
        consola.info("Use 'lspforge install' to install it first");
        process.exitCode = 1;
        return;
      }
      toUpdate = [[serverName, server]];
    } else {
      const state = await loadState();
      toUpdate = Object.entries(state.servers);
    }

    if (toUpdate.length === 0) {
      consola.info("No servers installed");
      return;
    }

    if (check) {
      consola.info("Checking for updates...\n");
    }

    const results: UpdateResult[] = [];

    for (const [name, server] of toUpdate) {
      const result = await updateServer(name, server, { force, check });
      results.push(result);
    }

    // Summary
    const errors = results.filter((r) => r.status === "error");

    if (check) {
      const updates = results.filter((r) => r.status === "updated");
      if (updates.length > 0) {
        consola.log("");
        consola.info("Available updates:");
        for (const r of updates) {
          consola.log(`  ${r.name}  ${r.fromVersion} → ${r.toVersion}`);
        }
        consola.log("");
        consola.info("Run 'lspforge update' to install all updates");
      } else if (errors.length === 0) {
        consola.success("All servers are up to date");
      }
    } else {
      const updated = results.filter((r) => r.status === "updated");
      const upToDate = results.filter((r) => r.status === "up-to-date");

      if (updated.length > 0) {
        consola.log("");
        for (const r of updated) {
          consola.success(`${r.name}  ${r.fromVersion} → ${r.toVersion}`);
        }
      }

      if (upToDate.length > 0) {
        for (const r of upToDate) {
          consola.info(`${r.name} is already up to date (v${r.fromVersion})`);
        }
      }
    }

    if (errors.length > 0) {
      for (const r of errors) {
        consola.error(`${r.name}: ${r.error}`);
      }
      process.exitCode = 1;
    }
  },
});
