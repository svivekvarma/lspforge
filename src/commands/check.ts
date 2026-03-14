import { defineCommand } from "citty";
import consola from "consola";
import { loadState, saveState } from "../core/state.js";
import { loadPackage } from "../core/registry.js";
import { checkLspHealth } from "../health/lsp-check.js";

export const checkCommand = defineCommand({
  meta: {
    name: "check",
    description: "Health check installed LSP servers",
  },
  args: {
    server: {
      type: "positional",
      description: "Specific server to check (omit for all)",
      required: false,
    },
  },
  async run({ args }) {
    const state = await loadState();
    const serverName = args.server as string | undefined;

    let toCheck: [string, typeof state.servers[string]][];

    if (serverName) {
      const server = state.servers[serverName];
      if (!server) {
        consola.error(`${serverName} is not installed`);
        process.exitCode = 1;
        return;
      }
      toCheck = [[serverName, server]];
    } else {
      toCheck = Object.entries(state.servers);
    }

    if (toCheck.length === 0) {
      consola.info("No servers installed");
      return;
    }

    let hasFailures = false;

    for (const [name, server] of toCheck) {
      const pkg = await loadPackage(name);
      const lspArgs = pkg?.lsp.args || ["--stdio"];
      const timeoutMs = pkg?.health?.timeout_ms || 10000;

      const result = await checkLspHealth(
        name,
        server.binPath,
        lspArgs,
        timeoutMs,
        server.installPath,
      );

      // Update state
      server.healthStatus = result.status === "ok" ? "ok" : "error";

      if (result.status === "ok") {
        consola.success(
          `${name.padEnd(30)} v${server.version.padEnd(12)} ok (${result.responseTimeMs}ms)`,
        );
      } else {
        hasFailures = true;
        consola.fail(
          `${name.padEnd(30)} v${server.version.padEnd(12)} ${result.status.toUpperCase()}`,
        );
        if (result.error) {
          consola.log(`    ${result.error}`);
        }
      }
    }

    await saveState(state);

    if (hasFailures) {
      process.exitCode = 1;
    }
  },
});
