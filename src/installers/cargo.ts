import { join } from "node:path";
import { platform } from "node:os";
import { access } from "node:fs/promises";
import { exec } from "../utils/spawn.js";
import type { PackageDefinition } from "../core/registry.js";
import type { PlatformInfo } from "../core/platform.js";
import type { InstallResult } from "./index.js";

export async function installCargo(
  pkg: PackageDefinition,
  installDir: string,
  _platformInfo: PlatformInfo,
): Promise<InstallResult> {
  const source = pkg.source.cargo!;
  const version = source.version ? `@${source.version}` : "";
  const packageSpec = `${source.package}${version}`;

  const result = await exec("cargo", [
    "install",
    "--root",
    installDir,
    packageSpec,
  ]);

  if (result.code !== 0) {
    throw new Error(`cargo install failed: ${result.stderr}`);
  }

  const isWindows = platform() === "win32";
  const binName = isWindows ? `${source.bin}.exe` : source.bin;
  const binPath = join(installDir, "bin", binName);

  await access(binPath).catch(() => {
    throw new Error(`Binary not found after install: ${binPath}`);
  });

  return {
    binPath,
    source: "cargo",
    version: source.version || "latest",
  };
}
