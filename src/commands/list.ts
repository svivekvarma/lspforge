import { defineCommand } from "citty";
import consola from "consola";
import { loadState } from "../core/state.js";
import { listPackages, loadAllPackages } from "../core/registry.js";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List installed LSP servers (use --available to browse registry)",
  },
  args: {
    available: {
      type: "boolean",
      alias: "a",
      description: "Show all available servers from registry",
      default: false,
    },
  },
  async run({ args }) {
    if (args.available) {
      const packages = await loadAllPackages();
      if (packages.length === 0) {
        consola.info("No packages found in registry");
        return;
      }

      // Non-interactive mode: plain text list (piped output or non-TTY)
      if (!process.stdout.isTTY) {
        for (const pkg of packages) {
          consola.log(`  ${pkg.name}`);
        }
        return;
      }

      // Interactive mode: show select prompt
      const state = await loadState();
      const choices = packages.map((pkg) => {
        const installed = pkg.name in state.servers;
        const languages = pkg.languages.join(", ");
        const label = installed
          ? `${pkg.name}  (${languages}) [installed]`
          : `${pkg.name}  (${languages})`;
        return { label, value: pkg.name, hint: pkg.description };
      });

      const selected = await consola.prompt("Select a server to install:", {
        type: "select",
        options: choices,
      });

      // User cancelled (Ctrl+C)
      if (typeof selected === "symbol") {
        return;
      }

      // Check if already installed
      if (selected in state.servers) {
        consola.info(`${selected} is already installed.`);
        return;
      }

      // Confirm and install
      const confirm = await consola.prompt(
        `Install ${selected}?`,
        { type: "confirm" },
      );

      if (typeof confirm === "symbol" || !confirm) {
        return;
      }

      const { installServer } = await import("./install.js");
      const success = await installServer(selected);
      if (!success) {
        process.exitCode = 1;
      }
      return;
    }

    const state = await loadState();
    const servers = Object.entries(state.servers);

    if (servers.length === 0) {
      consola.info("No servers installed. Run 'lspforge list --available' to browse servers, or 'lspforge init' to auto-detect.");
      return;
    }

    consola.info(`Installed servers (${servers.length}):`);
    for (const [name, info] of servers) {
      const status =
        info.healthStatus === "ok"
          ? "ok"
          : info.healthStatus === "error"
            ? "FAIL"
            : "?";
      consola.log(
        `  ${name.padEnd(30)} v${info.version.padEnd(12)} ${info.source.padEnd(8)} ${status}`,
      );
    }
  },
});
