import { defineCommand } from "citty";
import consola from "consola";
import { loadState } from "../core/state.js";
import { listPackages } from "../core/registry.js";

export const listCommand = defineCommand({
  meta: {
    name: "list",
    description: "List installed LSP servers",
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
      const packages = await listPackages();
      if (packages.length === 0) {
        consola.info("No packages found in registry");
        return;
      }
      consola.info("Available servers:");
      for (const name of packages) {
        consola.log(`  ${name}`);
      }
      return;
    }

    const state = await loadState();
    const servers = Object.entries(state.servers);

    if (servers.length === 0) {
      consola.info("No servers installed. Run 'lspforge install <server>' to get started.");
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
