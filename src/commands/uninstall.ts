import { defineCommand } from "citty";
import consola from "consola";
import { getServer, removeServer } from "../core/state.js";
import { detectClients } from "../clients/index.js";
import { rm } from "node:fs/promises";

export const uninstallCommand = defineCommand({
  meta: {
    name: "uninstall",
    description: "Remove an installed LSP server",
  },
  args: {
    server: {
      type: "positional",
      description: "Server name to uninstall",
      required: true,
    },
  },
  async run({ args }) {
    const serverName = args.server as string;

    const server = await getServer(serverName);
    if (!server) {
      consola.error(`${serverName} is not installed`);
      process.exitCode = 1;
      return;
    }

    // Remove from client configs
    const clients = await detectClients();
    for (const { name, client } of clients) {
      try {
        await client.unconfigure(serverName);
        consola.success(`Removed ${serverName} from ${name}`);
      } catch (err) {
        consola.warn(
          `Failed to remove from ${name}: ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Delete server files
    try {
      await rm(server.installPath, { recursive: true, force: true });
    } catch {
      consola.warn(`Could not delete ${server.installPath}`);
    }

    // Remove from state
    await removeServer(serverName);
    consola.success(`Uninstalled ${serverName}`);
  },
});
