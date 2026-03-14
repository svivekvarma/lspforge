import { defineCommand } from "citty";
import consola from "consola";
import { detectPlatform, detectRuntimes } from "../core/platform.js";
import { detectClients } from "../clients/index.js";
import { loadState } from "../core/state.js";
import { exec } from "../utils/spawn.js";

export const doctorCommand = defineCommand({
  meta: {
    name: "doctor",
    description: "Diagnose your environment",
  },
  async run() {
    // Platform
    const platform = detectPlatform();
    consola.info("Platform");
    consola.log(`  OS:           ${platform.os} ${platform.arch}`);
    consola.log(`  Key:          ${platform.key}`);

    // Node.js version
    consola.log(`  Node.js:      ${process.version}`);

    // Runtimes
    consola.info("\nRuntimes");
    const runtimes = await detectRuntimes();

    const runtimeChecks: [string, boolean, string][] = [
      ["npm", runtimes.npm, "npm --version"],
      ["python", runtimes.python, "python3 --version"],
      ["pip", runtimes.pip, "pip3 --version"],
      ["cargo", runtimes.cargo, "cargo --version"],
      ["go", runtimes.go, "go version"],
    ];

    for (const [name, available, versionCmd] of runtimeChecks) {
      if (available) {
        const parts = versionCmd.split(" ");
        const result = await exec(parts[0], parts.slice(1));
        const version = result.stdout.split("\n")[0].trim();
        consola.log(`  ${name.padEnd(14)} ${version}`);
      } else {
        consola.log(`  ${name.padEnd(14)} not found`);
      }
    }

    // AI Tools
    consola.info("\nAI Coding Tools");
    const clients = await detectClients();
    const allTools = ["Claude Code", "GitHub Copilot CLI", "Codex"];
    for (const tool of allTools) {
      const found = clients.some((c) => c.name === tool);
      consola.log(`  ${tool.padEnd(22)} ${found ? "installed" : "not found"}`);
    }

    // Installed servers
    const state = await loadState();
    const servers = Object.entries(state.servers);
    consola.info(`\nInstalled Servers: ${servers.length}`);

    if (servers.length > 0) {
      let ok = 0;
      let fail = 0;
      let unknown = 0;
      for (const [, s] of servers) {
        if (s.healthStatus === "ok") ok++;
        else if (s.healthStatus === "error") fail++;
        else unknown++;
      }
      consola.log(`  Healthy:      ${ok}`);
      if (fail > 0) consola.log(`  Failed:       ${fail}`);
      if (unknown > 0) consola.log(`  Unchecked:    ${unknown}`);
    }
  },
});
