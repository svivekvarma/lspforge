import { commandExists } from "../utils/spawn.js";
import { configureClaudeCode } from "./claude-code.js";
import { configureCopilotCli } from "./copilot-cli.js";
import { configureOpenCode } from "./opencode.js";
import { configureNeovim } from "./neovim.js";

export interface ClientConfig {
  serverName: string;
  binPath: string;
  args: string[];
  extensionToLanguage: Record<string, string>;
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
      name: "OpenCode",
      check: async () =>
        (await commandExists("opencode")) ||
        (await commandExists("crush")),
      client: {
        name: "OpenCode",
        configure: configureOpenCode,
        unconfigure: unconfigureOpenCode,
      },
    },
    {
      name: "Neovim",
      check: () => commandExists("nvim"),
      client: {
        name: "Neovim",
        configure: configureNeovim,
        unconfigure: unconfigureNeovim,
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

async function unconfigureOpenCode(serverName: string): Promise<void> {
  const { unconfigureOpenCode: fn } = await import("./opencode.js");
  await fn(serverName);
}

async function unconfigureNeovim(serverName: string): Promise<void> {
  const { unconfigureNeovim: fn } = await import("./neovim.js");
  await fn(serverName);
}
