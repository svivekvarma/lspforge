import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join, delimiter } from "node:path";
import { mkdtemp, readFile, writeFile, rm, access } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { spawnSync, execSync, execFileSync } from "node:child_process";
import { loadPackage } from "../core/registry.js";

/**
 * E2E smoke tests: run `lspforge install <server>` through the actual built
 * CLI, then verify state, binary, health, and client config output.
 *
 * Set LSPFORGE_E2E=1 to enable; skipped by default for fast local unit tests.
 *
 * When LSPFORGE_E2E=1 is set (CI), ALL suites run — missing runtimes will
 * cause test failures rather than silent skips, so CI catches setup issues.
 */
const E2E_ENABLED = process.env.LSPFORGE_E2E === "1";
const isWindows = platform() === "win32";

/**
 * Check that a runtime command is available on PATH.
 * Each entry is [command, ...args] to handle tools with non-standard
 * version flags (e.g. `go version` instead of `go --version`).
 */
function requireRuntime(...checks: (string | [string, ...string[]])[]): void {
  const errors: string[] = [];
  for (const check of checks) {
    const [cmd, ...args] = Array.isArray(check) ? check : [check, "--version"];
    const result = spawnSync(cmd, args, {
      encoding: "utf-8",
      timeout: 10_000,
      shell: true,
      stdio: "pipe",
    });
    if (!result.error && result.status === 0) return;
    errors.push(`${cmd}: status=${result.status} error=${result.error?.message ?? "none"}`);
  }
  throw new Error(
    `Required runtime not found: ${checks.map((c) => Array.isArray(c) ? c[0] : c).join(" or ")}. ` +
    `Details: [${errors.join("; ")}]. ` +
    `Ensure it is installed and on PATH in CI.`,
  );
}

/**
 * Force-remove a directory tree, handling read-only files (e.g. Go module cache).
 * Go sets module cache files to 444/r--r--r--, which causes EACCES on rm.
 */
async function forceRemove(dir: string): Promise<void> {
  if (!dir) return;
  if (!isWindows) {
    // chmod -R u+rwX first to make everything deletable
    try { execSync(`chmod -R u+rwX ${JSON.stringify(dir)}`, { stdio: "pipe" }); } catch { /* ignore */ }
  }
  await rm(dir, { recursive: true, force: true });
}

/** Resolve data dir per platform. */
function getDataDir(fakeHome: string): string {
  if (isWindows) return join(fakeHome, "AppData", "Local", "lspforge");
  if (platform() === "darwin") return join(fakeHome, ".lspforge");
  return join(fakeHome, ".local", "share", "lspforge");
}

/** Create CLI env overrides pointing at a fake home. */
function getCliEnv(fakeHome: string, extraPath?: string): NodeJS.ProcessEnv {
  const pathParts = [extraPath, process.env.PATH].filter(Boolean).join(delimiter);
  return {
    ...process.env,
    HOME: fakeHome,
    USERPROFILE: fakeHome,
    LOCALAPPDATA: join(fakeHome, "AppData", "Local"),
    XDG_DATA_HOME: join(fakeHome, ".local", "share"),
    PATH: pathParts,
  };
}

/** Run the built CLI with the given args. */
function runCli(
  cliPath: string,
  env: NodeJS.ProcessEnv,
  timeout: number,
  ...args: string[]
): { output: string; code: number | null } {
  const result = spawnSync("node", [cliPath, ...args], {
    env,
    encoding: "utf-8",
    timeout,
    shell: isWindows,
  });
  return {
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
    code: result.status,
  };
}

// ─── npm: typescript-language-server ───────────────────────────────────────────

describe.skipIf(!E2E_ENABLED)("E2E: npm installer (typescript-language-server)", { timeout: 120_000 }, () => {
  let fakeHome: string;
  let dataDir: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;

  beforeAll(async () => {
    requireRuntime("npm");

    fakeHome = await mkdtemp(join(tmpdir(), "lspforge-e2e-npm-"));
    dataDir = getDataDir(fakeHome);
    cliPath = join(process.cwd(), "dist", "cli.js");
    env = getCliEnv(fakeHome, join(process.cwd(), "node_modules", ".bin"));

    execFileSync("npm", ["run", "build"], {
      cwd: process.cwd(),
      stdio: "pipe",
      shell: isWindows,
    });
  });

  afterAll(async () => {
    await forceRemove(fakeHome);
  });

  it("installs and exits cleanly", () => {
    const { code } = runCli(cliPath, env, 90_000, "install", "typescript-language-server");
    expect(code).toBe(0);
  });

  it("creates state.json with correct server entry", async () => {
    const statePath = join(dataDir, "state.json");
    await expect(access(statePath)).resolves.toBeUndefined();

    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const server = state.servers["typescript-language-server"];

    expect(server).toBeDefined();
    expect(server.source).toBe("npm");
    const pkg = await loadPackage("typescript-language-server");
    expect(server.version).toBe(pkg!.source.npm!.version ?? "latest");
    expect(server.binPath).toBeTruthy();
    expect(server.installedAt).toBeTruthy();
  });

  it("installs the binary to the servers directory", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const binPath = state.servers["typescript-language-server"].binPath;

    await expect(access(binPath)).resolves.toBeUndefined();
    expect(binPath.startsWith(join(dataDir, "servers"))).toBe(true);
  });

  it("records health check result", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    expect(state.servers["typescript-language-server"].healthStatus).toBe("ok");
  });

  it("writes Claude Code .lsp.json config (if claude detected)", async () => {
    const lspConfigPath = join(fakeHome, ".claude", "plugins", "lspforge", ".lsp.json");
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
  });

  it("refuses to install again if already installed", () => {
    const { output } = runCli(cliPath, env, 90_000, "install", "typescript-language-server");
    expect(output).toContain("already installed");
  });
});

// ─── pip: python-lsp-server ───────────────────────────────────────────────────

describe.skipIf(!E2E_ENABLED)("E2E: pip installer (python-lsp-server)", { timeout: 180_000 }, () => {
  let fakeHome: string;
  let dataDir: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;

  beforeAll(async () => {
    requireRuntime("pip3", "pip");

    fakeHome = await mkdtemp(join(tmpdir(), "lspforge-e2e-pip-"));
    dataDir = getDataDir(fakeHome);
    cliPath = join(process.cwd(), "dist", "cli.js");
    env = getCliEnv(fakeHome);
  });

  afterAll(async () => {
    await forceRemove(fakeHome);
  });

  it("installs python-lsp-server via pip and exits cleanly", () => {
    const { code } = runCli(cliPath, env, 120_000, "install", "python-lsp-server");
    expect(code).toBe(0);
  });

  it("creates state.json with pip source", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const server = state.servers["python-lsp-server"];

    expect(server).toBeDefined();
    expect(server.source).toBe("pip");
    expect(server.binPath).toBeTruthy();
  });

  it("installs binary to servers directory", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const binPath = state.servers["python-lsp-server"].binPath;
    await expect(access(binPath)).resolves.toBeUndefined();
    expect(binPath.startsWith(join(dataDir, "servers"))).toBe(true);
  });
});

// ─── go: gopls ────────────────────────────────────────────────────────────────

describe.skipIf(!E2E_ENABLED)("E2E: go installer (gopls)", { timeout: 180_000 }, () => {
  let fakeHome: string;
  let dataDir: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;

  beforeAll(async () => {
    requireRuntime(["go", "version"]);

    fakeHome = await mkdtemp(join(tmpdir(), "lspforge-e2e-go-"));
    dataDir = getDataDir(fakeHome);
    cliPath = join(process.cwd(), "dist", "cli.js");
    env = getCliEnv(fakeHome);
  });

  afterAll(async () => {
    await forceRemove(fakeHome);
  });

  it("installs gopls via go and exits cleanly", () => {
    const { code } = runCli(cliPath, env, 120_000, "install", "gopls");
    expect(code).toBe(0);
  });

  it("creates state.json with go source", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const server = state.servers["gopls"];

    expect(server).toBeDefined();
    expect(server.source).toBe("go");
    expect(server.binPath).toBeTruthy();
  });

  it("installs binary to servers directory", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const binPath = state.servers["gopls"].binPath;
    await expect(access(binPath)).resolves.toBeUndefined();
    expect(binPath.startsWith(join(dataDir, "servers"))).toBe(true);
  });
});

// ─── cargo: taplo ─────────────────────────────────────────────────────────────

describe.skipIf(!E2E_ENABLED)("E2E: cargo installer (taplo)", { timeout: 300_000 }, () => {
  let fakeHome: string;
  let dataDir: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;

  beforeAll(async () => {
    requireRuntime("cargo");

    fakeHome = await mkdtemp(join(tmpdir(), "lspforge-e2e-cargo-"));
    dataDir = getDataDir(fakeHome);
    cliPath = join(process.cwd(), "dist", "cli.js");
    env = getCliEnv(fakeHome);
  });

  afterAll(async () => {
    await forceRemove(fakeHome);
  });

  it("installs taplo via cargo and exits cleanly", () => {
    const { code } = runCli(cliPath, env, 240_000, "install", "taplo");
    expect(code).toBe(0);
  });

  it("creates state.json with correct entry", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const server = state.servers["taplo"];

    expect(server).toBeDefined();
    expect(server.binPath).toBeTruthy();
  });

  it("installs binary to servers directory", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const binPath = state.servers["taplo"].binPath;
    await expect(access(binPath)).resolves.toBeUndefined();
    expect(binPath.startsWith(join(dataDir, "servers"))).toBe(true);
  });
});

// ─── update: typescript-language-server ────────────────────────────────────────

describe.skipIf(!E2E_ENABLED)("E2E: update command (typescript-language-server)", { timeout: 300_000 }, () => {
  let fakeHome: string;
  let dataDir: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;
  let registryVersion: string;

  beforeAll(async () => {
    requireRuntime("npm");

    fakeHome = await mkdtemp(join(tmpdir(), "lspforge-e2e-update-"));
    dataDir = getDataDir(fakeHome);
    cliPath = join(process.cwd(), "dist", "cli.js");
    env = getCliEnv(fakeHome, join(process.cwd(), "node_modules", ".bin"));

    const pkg = await loadPackage("typescript-language-server");
    registryVersion = pkg!.source.npm!.version ?? "latest";

    // Install the server at the current registry version
    const { code } = runCli(cliPath, env, 90_000, "install", "typescript-language-server");
    expect(code).toBe(0);
  });

  afterAll(async () => {
    await forceRemove(fakeHome);
  });

  it("exits 0 and leaves state unchanged when version matches registry", async () => {
    const statePath = join(dataDir, "state.json");
    const stateBefore = await readFile(statePath, "utf-8");

    const { code } = runCli(cliPath, env, 90_000, "update", "typescript-language-server");
    expect(code).toBe(0);

    const stateAfter = await readFile(statePath, "utf-8");
    expect(stateAfter).toBe(stateBefore);
  });

  it("--check does not modify state", async () => {
    const statePath = join(dataDir, "state.json");
    const stateBefore = await readFile(statePath, "utf-8");

    const { code } = runCli(cliPath, env, 90_000, "update", "--check");
    expect(code).toBe(0);

    const stateAfter = await readFile(statePath, "utf-8");
    expect(stateAfter).toBe(stateBefore);
  });

  it("updates state.json when an older version is recorded", async () => {
    // Fake an older version in state.json to simulate an outdated install
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const originalTimestamp = state.servers["typescript-language-server"].installedAt;
    state.servers["typescript-language-server"].version = "0.0.1";
    await writeFile(statePath, JSON.stringify(state, null, 2) + "\n", "utf-8");

    // --check should NOT change state
    const { code: checkCode } = runCli(cliPath, env, 90_000, "update", "--check");
    expect(checkCode).toBe(0);
    const stateAfterCheck = JSON.parse(await readFile(statePath, "utf-8"));
    expect(stateAfterCheck.servers["typescript-language-server"].version).toBe("0.0.1");

    // Now actually update
    const { code } = runCli(cliPath, env, 90_000, "update", "typescript-language-server");
    expect(code).toBe(0);

    // Verify state was updated to registry version
    const stateAfterUpdate = JSON.parse(await readFile(statePath, "utf-8"));
    const server = stateAfterUpdate.servers["typescript-language-server"];
    expect(server.version).toBe(registryVersion);
    expect(server.source).toBe("npm");
    expect(server.healthStatus).toBe("ok");
    expect(server.binPath).toBeTruthy();
    // installedAt should be refreshed
    expect(server.installedAt).not.toBe(originalTimestamp);
  });

  it("--force reinstalls and refreshes timestamp even when up-to-date", async () => {
    const statePath = join(dataDir, "state.json");
    const stateBefore = JSON.parse(await readFile(statePath, "utf-8"));
    const timestampBefore = stateBefore.servers["typescript-language-server"].installedAt;

    // Small delay to ensure timestamp differs
    await new Promise((r) => setTimeout(r, 1100));

    const { code } = runCli(cliPath, env, 90_000, "update", "typescript-language-server", "--force");
    expect(code).toBe(0);

    const stateAfter = JSON.parse(await readFile(statePath, "utf-8"));
    const server = stateAfter.servers["typescript-language-server"];
    expect(server.version).toBe(registryVersion);
    expect(server.source).toBe("npm");
    expect(server.healthStatus).toBe("ok");
    expect(server.installedAt).not.toBe(timestampBefore);
  });

  it("exits 1 when server is not installed", () => {
    const { code } = runCli(cliPath, env, 30_000, "update", "nonexistent-server");
    expect(code).toBe(1);
  });
});

// ─── binary: rust-analyzer ────────────────────────────────────────────────────

describe.skipIf(!E2E_ENABLED)("E2E: binary installer (rust-analyzer)", { timeout: 180_000 }, () => {
  let fakeHome: string;
  let dataDir: string;
  let cliPath: string;
  let env: NodeJS.ProcessEnv;

  beforeAll(async () => {
    fakeHome = await mkdtemp(join(tmpdir(), "lspforge-e2e-binary-"));
    dataDir = getDataDir(fakeHome);
    cliPath = join(process.cwd(), "dist", "cli.js");
    env = getCliEnv(fakeHome);
  });

  afterAll(async () => {
    await forceRemove(fakeHome);
  });

  it("installs rust-analyzer via binary download and exits cleanly", () => {
    const { code } = runCli(cliPath, env, 120_000, "install", "rust-analyzer");
    expect(code).toBe(0);
  });

  it("creates state.json with binary source", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const server = state.servers["rust-analyzer"];

    expect(server).toBeDefined();
    expect(server.source).toBe("binary");
    expect(server.binPath).toBeTruthy();
  });

  it("installs binary to servers directory", async () => {
    const statePath = join(dataDir, "state.json");
    const state = JSON.parse(await readFile(statePath, "utf-8"));
    const binPath = state.servers["rust-analyzer"].binPath;
    await expect(access(binPath)).resolves.toBeUndefined();
    expect(binPath.startsWith(join(dataDir, "servers"))).toBe(true);
  });
});
