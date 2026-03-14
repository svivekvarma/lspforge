import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join, delimiter } from "node:path";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
import { loadPackage } from "../core/registry.js";

/**
 * E2E smoke test: run `lspforge install typescript-language-server`
 * through the actual built CLI, then verify state, binary, health,
 * and Claude Code config output.
 *
 * Requires network access and takes ~30-60s on first run.
 * Set LSPFORGE_E2E=1 to enable; skipped by default for fast unit tests.
 */
describe.skipIf(process.env.LSPFORGE_E2E !== "1")("E2E: lspforge install typescript-language-server", { timeout: 120_000 }, () => {
  const isWindows = platform() === "win32";
  let fakeHome: string;
  let dataDir: string;
  let cliPath: string;

  beforeAll(async () => {
    fakeHome = await mkdtemp(join(tmpdir(), "lspforge-e2e-home-"));

    // Match getDataDir() logic per platform
    if (isWindows) {
      dataDir = join(fakeHome, "AppData", "Local", "lspforge");
    } else if (platform() === "darwin") {
      dataDir = join(fakeHome, ".lspforge");
    } else {
      dataDir = join(fakeHome, ".local", "share", "lspforge");
    }

    cliPath = join(process.cwd(), "dist", "cli.js");

    // Build first to ensure dist/ is up to date
    execFileSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: isWindows,
    });
  });

  afterAll(async () => {
    await rm(fakeHome, { recursive: true, force: true });
  });

  function getCliEnv(): NodeJS.ProcessEnv {
    return {
      ...process.env,
      HOME: fakeHome,
      USERPROFILE: fakeHome,
      LOCALAPPDATA: join(fakeHome, "AppData", "Local"),
      XDG_DATA_HOME: join(fakeHome, ".local", "share"),
      // Add project's node_modules/.bin to PATH so tsserver is available
      // for the health check (typescript-language-server needs it)
      PATH: `${join(process.cwd(), "node_modules", ".bin")}${delimiter}${process.env.PATH}`,
    };
  }

  /** Run a CLI command and return combined stdout+stderr output. */
  function runCli(...args: string[]): { output: string; code: number | null } {
    const result = spawnSync("node", [cliPath, ...args], {
      env: getCliEnv(),
      encoding: "utf-8",
      timeout: 90_000,
      shell: isWindows,
    });
    const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
    return { output, code: result.status };
  }

  it("runs lspforge install and exits cleanly", () => {
    const { output, code } = runCli("install", "typescript-language-server");

    // Exit code 0 means install succeeded. consola output goes to
    // different streams depending on TTY detection, so we verify the
    // actual artifacts (state.json, binary, config) in later tests.
    expect(code).toBe(0);
  });

  it("creates state.json with correct server entry", async () => {
    const statePath = join(dataDir, "state.json");
    await expect(access(statePath)).resolves.toBeUndefined();

    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const server = state.servers["typescript-language-server"];

    expect(server).toBeDefined();
    expect(server.source).toBe("npm");
    // Read expected version from registry so test doesn't break on updates
    const pkg = await loadPackage("typescript-language-server");
    expect(pkg).toBeTruthy();
    expect(pkg!.source.npm).toBeTruthy();
    expect(server.version).toBe(pkg!.source.npm!.version ?? "latest");
    expect(server.binPath).toBeTruthy();
    expect(server.installedAt).toBeTruthy();
  });

  it("installs the binary to the servers directory", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const binPath = state.servers["typescript-language-server"].binPath;

    await expect(access(binPath)).resolves.toBeUndefined();

    // Verify it's inside the lspforge servers dir
    const serversDir = join(dataDir, "servers");
    expect(binPath.startsWith(serversDir)).toBe(true);
  });

  it("records health check result", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const server = state.servers["typescript-language-server"];

    // typescript is co-installed via extra_packages, so health check should pass
    expect(server.healthStatus).toBe("ok");
  });

  it("writes Claude Code .lsp.json config (if claude detected)", async () => {
    const lspConfigPath = join(
      fakeHome,
      ".claude",
      "plugins",
      "lspforge",
      ".lsp.json",
    );

    // Claude Code config is only written if `claude` is on PATH.
    // On machines without Claude CLI, skip gracefully.
    try {
      await access(lspConfigPath);
    } catch {
      console.log("Claude CLI not on PATH — skipping config verification");
      return;
    }

    const config = JSON.parse(await readFile(lspConfigPath, "utf-8"));
    const entry = config["typescript-language-server"];

    expect(entry).toBeDefined();
    expect(entry.command).toBeTruthy();
    expect(entry.args).toEqual(["--stdio"]);
    expect(entry.extensionToLanguage).toEqual({
      ".ts": "typescript",
      ".tsx": "typescriptreact",
      ".js": "javascript",
      ".jsx": "javascriptreact",
    });

    // Verify plugin manifest
    const manifestPath = join(
      fakeHome,
      ".claude",
      "plugins",
      "lspforge",
      ".claude-plugin",
      "plugin.json",
    );
    const manifest = JSON.parse(await readFile(manifestPath, "utf-8"));
    expect(manifest.name).toBe("lspforge");
    expect(manifest.lspServers).toBe("./.lsp.json");
  });

  it("refuses to install again if already installed", () => {
    const { output } = runCli("install", "typescript-language-server");

    expect(output).toContain("already installed");
  });
});
