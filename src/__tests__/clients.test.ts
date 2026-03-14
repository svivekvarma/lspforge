import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import { parse as parseToml } from "smol-toml";
import {
  configureClaudeCode,
  unconfigureClaudeCode,
} from "../clients/claude-code.js";
import {
  configureCopilotCli,
  unconfigureCopilotCli,
} from "../clients/copilot-cli.js";
import {
  configureCodex,
  unconfigureCodex,
} from "../clients/codex.js";

// ─── Claude Code ───────────────────────────────────────────────────────────
// configureClaudeCode reads homedir() at call time, so overriding
// HOME/USERPROFILE before each call is sufficient — no cache busting needed.

describe("Claude Code config writer", () => {
  let tempDir: string;
  let pluginDir: string;
  let lspConfigPath: string;
  let manifestPath: string;
  let originalHome: string;
  let originalUserprofile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lspforge-claude-test-"));
    pluginDir = join(tempDir, ".claude", "plugins", "lspforge");
    lspConfigPath = join(pluginDir, ".lsp.json");
    manifestPath = join(pluginDir, ".claude-plugin", "plugin.json");

    originalHome = process.env.HOME || homedir();
    originalUserprofile = process.env.USERPROFILE || homedir();
    process.env.HOME = tempDir;
    process.env.USERPROFILE = tempDir;
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserprofile;
    await rm(tempDir, { recursive: true });
  });

  it("creates .lsp.json and plugin manifest from scratch", async () => {
    await configureClaudeCode({
      serverName: "typescript-language-server",
      binPath: "/usr/bin/typescript-language-server",
      args: ["--stdio"],
      extensionToLanguage: { ".ts": "typescript", ".js": "javascript" },
    });

    expect(existsSync(lspConfigPath)).toBe(true);
    expect(existsSync(manifestPath)).toBe(true);

    const config = JSON.parse(await readFile(lspConfigPath, "utf-8"));
    expect(config["typescript-language-server"]).toEqual({
      command: "/usr/bin/typescript-language-server",
      args: ["--stdio"],
      extensionToLanguage: { ".ts": "typescript", ".js": "javascript" },
    });

    const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    expect(manifest.name).toBe("lspforge");
    expect(manifest.lspServers).toBe("./.lsp.json");
  });

  it("appends to existing .lsp.json without overwriting other servers", async () => {
    await configureClaudeCode({
      serverName: "pyright",
      binPath: "/usr/bin/pyright-langserver",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    await configureClaudeCode({
      serverName: "typescript-language-server",
      binPath: "/usr/bin/tsserver",
      args: ["--stdio"],
      extensionToLanguage: { ".ts": "typescript" },
    });

    const config = JSON.parse(await readFile(lspConfigPath, "utf-8"));
    expect(config["pyright"]).toBeDefined();
    expect(config["typescript-language-server"]).toBeDefined();
    expect(config["pyright"].command).toBe("/usr/bin/pyright-langserver");
    expect(config["typescript-language-server"].command).toBe("/usr/bin/tsserver");
  });

  it("unconfigure removes one server but keeps others", async () => {
    await configureClaudeCode({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });
    await configureClaudeCode({
      serverName: "tsserver",
      binPath: "/usr/bin/tsserver",
      args: ["--stdio"],
      extensionToLanguage: { ".ts": "typescript" },
    });

    await unconfigureClaudeCode("pyright");

    const config = JSON.parse(await readFile(lspConfigPath, "utf-8"));
    expect(config["pyright"]).toBeUndefined();
    expect(config["tsserver"]).toBeDefined();
  });

  it("unconfigure last server cleans up plugin directory", async () => {
    await configureClaudeCode({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    await unconfigureClaudeCode("pyright");

    expect(existsSync(pluginDir)).toBe(false);
  });
});

// ─── GitHub Copilot CLI ────────────────────────────────────────────────────

describe("Copilot CLI config writer", () => {
  let tempDir: string;
  let configPath: string;
  let originalCopilotHome: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lspforge-copilot-test-"));
    configPath = join(tempDir, "lsp-config.json");
    originalCopilotHome = process.env.COPILOT_HOME;
    process.env.COPILOT_HOME = tempDir;
  });

  afterEach(async () => {
    if (originalCopilotHome === undefined) {
      delete process.env.COPILOT_HOME;
    } else {
      process.env.COPILOT_HOME = originalCopilotHome;
    }
    await rm(tempDir, { recursive: true });
  });

  it("creates lsp-config.json from scratch", async () => {
    await configureCopilotCli({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.lspServers.pyright).toEqual({
      _managed_by: "lspforge",
      command: "/usr/bin/pyright",
      args: ["--stdio"],
      fileExtensions: { ".py": "python" },
    });
  });

  it("appends to existing config preserving user entries", async () => {
    await writeFile(
      configPath,
      JSON.stringify(
        {
          lspServers: {
            "my-custom-lsp": { command: "/opt/custom-lsp", args: [] },
          },
          otherSetting: true,
        },
        null,
        2,
      ),
    );

    await configureCopilotCli({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.lspServers["my-custom-lsp"].command).toBe("/opt/custom-lsp");
    expect(config.lspServers.pyright._managed_by).toBe("lspforge");
    expect(config.otherSetting).toBe(true);
  });

  it("unconfigure only removes _managed_by entries", async () => {
    await writeFile(
      configPath,
      JSON.stringify(
        {
          lspServers: {
            pyright: {
              _managed_by: "lspforge",
              command: "/usr/bin/pyright",
              args: ["--stdio"],
            },
            "user-server": { command: "/opt/user-server", args: [] },
          },
        },
        null,
        2,
      ),
    );

    await unconfigureCopilotCli("pyright");

    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.lspServers.pyright).toBeUndefined();
    expect(config.lspServers["user-server"]).toBeDefined();
  });

  it("unconfigure does not remove entry without _managed_by tag", async () => {
    await writeFile(
      configPath,
      JSON.stringify(
        {
          lspServers: {
            pyright: { command: "/usr/bin/pyright", args: ["--stdio"] },
          },
        },
        null,
        2,
      ),
    );

    await unconfigureCopilotCli("pyright");

    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.lspServers.pyright).toBeDefined();
  });
});

// ─── OpenAI Codex ──────────────────────────────────────────────────────────

describe("Codex config writer", () => {
  let tempDir: string;
  let configPath: string;
  let originalHome: string;
  let originalUserprofile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lspforge-codex-test-"));
    originalHome = process.env.HOME || homedir();
    originalUserprofile = process.env.USERPROFILE || homedir();
    process.env.HOME = tempDir;
    process.env.USERPROFILE = tempDir;
    configPath = join(tempDir, ".codex", "config.toml");
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    process.env.USERPROFILE = originalUserprofile;
    await rm(tempDir, { recursive: true });
  });

  it("creates config.toml from scratch", async () => {
    await configureCodex({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    expect(existsSync(configPath)).toBe(true);
    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;
    const mcpServers = config.mcp_servers as Record<string, unknown>;
    const pyright = mcpServers.pyright as Record<string, unknown>;
    expect(pyright._managed_by).toBe("lspforge");
    expect(pyright.command).toBe("/usr/bin/pyright");
    expect(pyright.args).toEqual(["--stdio"]);
  });

  it("appends to existing TOML preserving other sections", async () => {
    await mkdir(join(tempDir, ".codex"), { recursive: true });
    await writeFile(
      configPath,
      `model = "gpt-4"\n\n[settings]\ntheme = "dark"\n`,
    );

    await configureCodex({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;
    expect(config.model).toBe("gpt-4");
    const settings = config.settings as Record<string, unknown>;
    expect(settings.theme).toBe("dark");
    const mcpServers = config.mcp_servers as Record<string, unknown>;
    expect(mcpServers.pyright).toBeDefined();
  });

  it("appends second server alongside first", async () => {
    await configureCodex({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });
    await configureCodex({
      serverName: "gopls",
      binPath: "/usr/bin/gopls",
      args: ["serve"],
      extensionToLanguage: { ".go": "go" },
    });

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;
    const mcpServers = config.mcp_servers as Record<string, unknown>;
    expect(mcpServers.pyright).toBeDefined();
    expect(mcpServers.gopls).toBeDefined();
  });

  it("unconfigure only removes _managed_by entries", async () => {
    await mkdir(join(tempDir, ".codex"), { recursive: true });
    await writeFile(
      configPath,
      [
        `[mcp_servers.pyright]`,
        `_managed_by = "lspforge"`,
        `command = "/usr/bin/pyright"`,
        `args = ["--stdio"]`,
        ``,
        `[mcp_servers.user-server]`,
        `command = "/opt/user-server"`,
        `args = []`,
      ].join("\n") + "\n",
    );

    await unconfigureCodex("pyright");

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;
    const mcpServers = config.mcp_servers as Record<string, unknown>;
    expect(mcpServers.pyright).toBeUndefined();
    expect(mcpServers["user-server"]).toBeDefined();
  });

  it("unconfigure does not remove entry without _managed_by tag", async () => {
    await mkdir(join(tempDir, ".codex"), { recursive: true });
    await writeFile(
      configPath,
      [
        `[mcp_servers.pyright]`,
        `command = "/usr/bin/pyright"`,
        `args = ["--stdio"]`,
      ].join("\n") + "\n",
    );

    await unconfigureCodex("pyright");

    const content = await readFile(configPath, "utf-8");
    const config = parseToml(content) as Record<string, unknown>;
    const mcpServers = config.mcp_servers as Record<string, unknown>;
    expect(mcpServers.pyright).toBeDefined();
  });
});
