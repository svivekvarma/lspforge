import { commandExists } from "../utils/spawn.js";
import { configureClaudeCode } from "./claude-code.js";
import { configureCopilotCli } from "./copilot-cli.js";
import { configureCodex } from "./codex.js";

export interface ClientConfig {
  serverName: string;
  binPath: string;
  args: string[];
}

export interface Client {
  name: string;
  configure(config: ClientConfig): Promise<void>;
  unconfigure(serverName: string): Promise<void>;
}

export interface DetectedClient {
  name: string;
  client: Client;
}

/**
 * Detect which AI coding tools are installed.
 */
export async function detectClients(): Promise<DetectedClient[]> {
  const clients: DetectedClient[] = [];

  const checks = [
    {
      name: "Claude Code",
      check: () => commandExists("claude"),
      client: {
        name: "Claude Code",
        configure: configureClaudeCode,
        unconfigure: unconfigureClaudeCode,
      },
    },
    {
      name: "GitHub Copilot CLI",
      check: async () =>
        (await commandExists("github-copilot-cli")) ||
        (await commandExists("gh")),
      client: {
        name: "GitHub Copilot CLI",
        configure: configureCopilotCli,
        unconfigure: unconfigureCopilotCli,
      },
    },
    {
      name: "Codex",
      check: () => commandExists("codex"),
      client: {
        name: "Codex",
        configure: configureCodex,
        unconfigure: unconfigureCodex,
      },
    },
  ];

  for (const { name, check, client } of checks) {
    if (await check()) {
      clients.push({ name, client });
    }
  }

  return clients;
}

// Re-export unconfigure functions
async function unconfigureClaudeCode(serverName: string): Promise<void> {
  const { unconfigureClaudeCode: fn } = await import("./claude-code.js");
  await fn(serverName);
}

async function unconfigureCopilotCli(serverName: string): Promise<void> {
  const { unconfigureCopilotCli: fn } = await import("./copilot-cli.js");
  await fn(serverName);
}

async function unconfigureCodex(serverName: string): Promise<void> {
  const { unconfigureCodex: fn } = await import("./codex.js");
  await fn(serverName);
}
