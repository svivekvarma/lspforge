import { join } from "node:path";
import { platform } from "node:os";
import { access } from "node:fs/promises";
import { exec } from "../utils/spawn.js";
import type { PackageDefinition } from "../core/registry.js";
import type { PlatformInfo } from "../core/platform.js";
import type { InstallResult } from "./index.js";

export async function installPip(
  pkg: PackageDefinition,
  installDir: string,
  _platformInfo: PlatformInfo,
): Promise<InstallResult> {
  const source = pkg.source.pip!;
  const isWindows = platform() === "win32";
  const pythonCmd = isWindows ? "python" : "python3";
  const venvDir = join(installDir, "venv");

  // Create venv
  const venvResult = await exec(pythonCmd, ["-m", "venv", venvDir]);
  if (venvResult.code !== 0) {
    throw new Error(`Failed to create venv: ${venvResult.stderr}`);
  }

  // Install package into venv
  const pipBin = isWindows
    ? join(venvDir, "Scripts", "pip.exe")
    : join(venvDir, "bin", "pip");

  const version = source.version ? `==${source.version}` : "";
  const packageSpec = `${source.package}${version}`;

  const installResult = await exec(pipBin, ["install", packageSpec]);
  if (installResult.code !== 0) {
    throw new Error(`pip install failed: ${installResult.stderr}`);
  }

  // Resolve binary path
  const binDir = isWindows
    ? join(venvDir, "Scripts")
    : join(venvDir, "bin");
  const binName = isWindows ? `${source.bin}.exe` : source.bin;
  const binPath = join(binDir, binName);

  await access(binPath).catch(() => {
    throw new Error(`Binary not found after install: ${binPath}`);
  });

  return {
    binPath,
    source: "pip",
    version: source.version || "latest",
  };
}
