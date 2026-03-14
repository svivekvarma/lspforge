import { defineCommand } from "citty";
import consola from "consola";
import { detectLanguages } from "../detect/languages.js";
import { detectClients } from "../clients/index.js";
import { detectPlatform, detectRuntimes } from "../core/platform.js";
import { loadPackage } from "../core/registry.js";
import { getServerDir, ensureDataDirs } from "../core/paths.js";
import { addServer, getServer } from "../core/state.js";
import { selectInstaller } from "../installers/index.js";
import { checkLspHealth } from "../health/lsp-check.js";

export const initCommand = defineCommand({
  meta: {
    name: "init",
    description: "Detect project languages and install recommended LSP servers",
  },
  args: {
    dir: {
      type: "string",
      alias: "d",
      description: "Project directory to scan",
      default: ".",
    },
    "skip-config": {
      type: "boolean",
      description: "Skip configuring AI tool clients",
      default: false,
    },
  },
  async run({ args }) {
    const projectDir = args.dir as string;

    // Step 1: Detect languages
    consola.start("Scanning project for languages...");
    const languages = await detectLanguages(projectDir);

    if (languages.length === 0) {
      consola.warn("No languages detected in this directory");
      return;
    }

    consola.info("Detected languages:");
    for (const lang of languages) {
      consola.log(
        `  ${lang.language} (${lang.confidence}) → ${lang.recommendedServers.join(", ") || "no server available"}`,
      );
    }

    // Step 2: Detect AI tools
    const clients = await detectClients();
    if (clients.length > 0) {
      consola.info(
        `Detected AI tools: ${clients.map((c) => c.name).join(", ")}`,
      );
    } else {
      consola.warn(
        "No AI coding tools detected (Claude Code, Copilot CLI, Codex)",
      );
    }

    // Step 3: Collect recommended servers
    const serversToInstall = new Set<string>();
    for (const lang of languages) {
      for (const server of lang.recommendedServers) {
        serversToInstall.add(server);
      }
    }

    if (serversToInstall.size === 0) {
      consola.info("No recommended servers for detected languages");
      return;
    }

    consola.info(
      `\nWill install: ${Array.from(serversToInstall).join(", ")}`,
    );

    // Step 4: Install each server
    const platformInfo = detectPlatform();
    const runtimes = await detectRuntimes();
    await ensureDataDirs();

    for (const serverName of serversToInstall) {
      // Skip if already installed
      const existing = await getServer(serverName);
      if (existing) {
        consola.success(`${serverName} already installed (${existing.version})`);
        continue;
      }

      const pkg = await loadPackage(serverName);
      if (!pkg) {
        consola.warn(`${serverName} not found in registry, skipping`);
        continue;
      }

      const selected = selectInstaller(pkg.source, runtimes);
      if (!selected) {
        consola.warn(
          `No compatible installer for ${serverName}, skipping`,
        );
        continue;
      }

      consola.start(`Installing ${serverName} via ${selected.type}...`);
      const installDir = getServerDir(serverName);

      try {
        const result = await selected.installer(
          pkg,
          installDir,
          platformInfo,
        );
        consola.success(
          `Installed ${serverName} v${result.version}`,
        );

        // Health check
        const health = await checkLspHealth(
          serverName,
          result.binPath,
          pkg.lsp.args,
          pkg.health?.timeout_ms,
        );

        await addServer(serverName, {
          version: result.version,
          source: result.source,
          installPath: installDir,
          binPath: result.binPath,
          installedAt: new Date().toISOString(),
          healthStatus: health.status === "ok" ? "ok" : "error",
        });

        if (health.status === "ok") {
          consola.success(`  Health check passed (${health.responseTimeMs}ms)`);
        } else {
          consola.warn(`  Health check: ${health.error}`);
        }

        // Configure clients
        if (!args["skip-config"]) {
          for (const { client } of clients) {
            try {
              await client.configure({
                serverName,
                binPath: result.binPath,
                args: pkg.lsp.args,
              });
            } catch (err) {
              consola.warn(
                `  Config error: ${err instanceof Error ? err.message : err}`,
              );
            }
          }
        }
      } catch (err) {
        consola.error(
          `Failed to install ${serverName}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    consola.box("lspforge init complete!");
  },
});
