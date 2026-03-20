import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, readFile, writeFile, rm, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  configureClaudeCode,
  unconfigureClaudeCode,
} from "../clients/claude-code.js";
import {
  configureCopilotCli,
  unconfigureCopilotCli,
} from "../clients/copilot-cli.js";
import {
  configureOpenCode,
  unconfigureOpenCode,
} from "../clients/opencode.js";
import {
  configureNeovim,
  unconfigureNeovim,
} from "../clients/neovim.js";

// ─── Claude Code ───────────────────────────────────────────────────────────
// configureClaudeCode reads homedir() at call time, so overriding
// HOME/USERPROFILE before each call is sufficient — no cache busting needed.

describe("Claude Code config writer", () => {
  let tempDir: string;
  let pluginDir: string;
  let lspConfigPath: string;
  let manifestPath: string;
  let originalHome: string | undefined;
  let originalUserprofile: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lspforge-claude-test-"));
    pluginDir = join(tempDir, ".claude", "plugins", "lspforge");
    lspConfigPath = join(pluginDir, ".lsp.json");
    manifestPath = join(pluginDir, ".claude-plugin", "plugin.json");

    originalHome = process.env.HOME;
    originalUserprofile = process.env.USERPROFILE;
    process.env.HOME = tempDir;
    process.env.USERPROFILE = tempDir;
  });

  afterEach(async () => {
    if (originalHome === undefined) { delete process.env.HOME; } else { process.env.HOME = originalHome; }
    if (originalUserprofile === undefined) { delete process.env.USERPROFILE; } else { process.env.USERPROFILE = originalUserprofile; }
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

// ─── OpenCode/Crush ────────────────────────────────────────────────────────

describe("OpenCode config writer", () => {
  let tempDir: string;
  let configPath: string;
  let originalCwd: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lspforge-opencode-test-"));
    configPath = join(tempDir, "opencode.json");
    // OpenCode reads config from cwd, so we need to change cwd
    originalCwd = process.cwd();
    process.chdir(tempDir);
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { recursive: true });
  });

  it("creates opencode.json from scratch", async () => {
    await configureOpenCode({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    expect(existsSync(configPath)).toBe(true);
    const config = JSON.parse(await readFile(configPath, "utf-8"));
    const lsp = config.lsp as Record<string, unknown>;
    const pyright = lsp.pyright as Record<string, unknown>;
    expect(pyright._managed_by).toBe("lspforge");
    expect(pyright.command).toBe("/usr/bin/pyright");
    expect(pyright.args).toEqual(["--stdio"]);
    expect(pyright.extensions).toEqual([".py"]);
  });

  it("appends to existing config preserving other sections", async () => {
    await writeFile(
      configPath,
      JSON.stringify({ model: "gpt-4", theme: "dark" }, null, 2),
    );

    await configureOpenCode({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.model).toBe("gpt-4");
    expect(config.theme).toBe("dark");
    expect(config.lsp.pyright).toBeDefined();
  });

  it("appends second server alongside first", async () => {
    await configureOpenCode({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });
    await configureOpenCode({
      serverName: "gopls",
      binPath: "/usr/bin/gopls",
      args: ["serve"],
      extensionToLanguage: { ".go": "go" },
    });

    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.lsp.pyright).toBeDefined();
    expect(config.lsp.gopls).toBeDefined();
  });

  it("uses .crush.json if it exists", async () => {
    const crushPath = join(tempDir, ".crush.json");
    await writeFile(crushPath, JSON.stringify({ lsp: {} }, null, 2));

    await configureOpenCode({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    // Should write to .crush.json, not opencode.json
    const config = JSON.parse(await readFile(crushPath, "utf-8"));
    expect(config.lsp.pyright).toBeDefined();
    expect(existsSync(configPath)).toBe(false);
  });

  it("unconfigure only removes _managed_by entries", async () => {
    await writeFile(
      configPath,
      JSON.stringify(
        {
          lsp: {
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

    await unconfigureOpenCode("pyright");

    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.lsp.pyright).toBeUndefined();
    expect(config.lsp["user-server"]).toBeDefined();
  });

  it("unconfigure does not remove entry without _managed_by tag", async () => {
    await writeFile(
      configPath,
      JSON.stringify(
        {
          lsp: {
            pyright: { command: "/usr/bin/pyright", args: ["--stdio"] },
          },
        },
        null,
        2,
      ),
    );

    await unconfigureOpenCode("pyright");

    const config = JSON.parse(await readFile(configPath, "utf-8"));
    expect(config.lsp.pyright).toBeDefined();
  });
});

// ─── Neovim ────────────────────────────────────────────────────────────────

describe("Neovim config writer", () => {
  let tempDir: string;
  let originalXdgConfigHome: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "lspforge-neovim-test-"));
    originalXdgConfigHome = process.env.XDG_CONFIG_HOME;
    process.env.XDG_CONFIG_HOME = tempDir;
  });

  afterEach(async () => {
    if (originalXdgConfigHome === undefined) {
      delete process.env.XDG_CONFIG_HOME;
    } else {
      process.env.XDG_CONFIG_HOME = originalXdgConfigHome;
    }
    await rm(tempDir, { recursive: true });
  });

  it("creates lua config from scratch", async () => {
    await configureNeovim({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    const configPath = join(tempDir, "nvim", "plugin", "lspforge", "pyright.lua");
    expect(existsSync(configPath)).toBe(true);

    const content = await readFile(configPath, "utf-8");
    expect(content).toContain("-- _managed_by: lspforge");
    expect(content).toContain("vim.lsp.config['pyright'] = {");
    expect(content).toContain("cmd = { '/usr/bin/pyright', '--stdio' }");
    expect(content).toContain("filetypes = { 'python' }");
    expect(content).toContain("vim.lsp.enable('pyright')");
  });

  it("unconfigure removes file if managed by lspforge", async () => {
    const configPath = join(tempDir, "nvim", "plugin", "lspforge", "pyright.lua");
    await mkdir(join(tempDir, "nvim", "plugin", "lspforge"), { recursive: true });

    await configureNeovim({
      serverName: "pyright",
      binPath: "/usr/bin/pyright",
      args: ["--stdio"],
      extensionToLanguage: { ".py": "python" },
    });

    expect(existsSync(configPath)).toBe(true);

    await unconfigureNeovim("pyright");

    expect(existsSync(configPath)).toBe(false);
  });

  it("unconfigure does not remove file if not managed by lspforge", async () => {
    const configPath = join(tempDir, "nvim", "plugin", "lspforge", "pyright.lua");
    await mkdir(join(tempDir, "nvim", "plugin", "lspforge"), { recursive: true });
    await writeFile(configPath, "print('custom config')", "utf-8");

    await unconfigureNeovim("pyright");

    expect(existsSync(configPath)).toBe(true);
  });
});
