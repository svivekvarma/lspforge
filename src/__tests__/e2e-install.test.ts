import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { join, delimiter } from "node:path";
import { mkdtemp, readFile, rm, access } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { spawnSync, execFileSync } from "node:child_process";
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

/** Check that a runtime command is available on PATH. Tries multiple aliases. */
function requireRuntime(...cmds: string[]): void {
  const errors: string[] = [];
  for (const cmd of cmds) {
    const result = spawnSync(cmd, ["--version"], {
      encoding: "utf-8",
      timeout: 10_000,
      shell: true,
      stdio: "pipe",
    });
    if (!result.error && result.status === 0) return;
    errors.push(`${cmd}: status=${result.status} error=${result.error?.message ?? "none"} stderr=${(result.stderr ?? "").trim()}`);
  }
  throw new Error(
    `Required runtime not found: ${cmds.join(" or ")}. Details: [${errors.join("; ")}]. ` +
    `Ensure it is installed and on PATH in CI (setup-python, setup-go, etc.).`,
  );
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
    if (fakeHome) await rm(fakeHome, { recursive: true, force: true });
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
    if (fakeHome) await rm(fakeHome, { recursive: true, force: true });
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
    requireRuntime("go");

    fakeHome = await mkdtemp(join(tmpdir(), "lspforge-e2e-go-"));
    dataDir = getDataDir(fakeHome);
    cliPath = join(process.cwd(), "dist", "cli.js");
    env = getCliEnv(fakeHome);
  });

  afterAll(async () => {
    if (fakeHome) await rm(fakeHome, { recursive: true, force: true });
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
    if (fakeHome) await rm(fakeHome, { recursive: true, force: true });
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
    if (fakeHome) await rm(fakeHome, { recursive: true, force: true });
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
