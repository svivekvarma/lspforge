import { join } from "node:path";
import { platform } from "node:os";
import { access } from "node:fs/promises";
import { exec } from "../utils/spawn.js";
import type { PackageDefinition } from "../core/registry.js";
import type { PlatformInfo } from "../core/platform.js";
import type { InstallResult } from "./index.js";

export async function installNpm(
  pkg: PackageDefinition,
  installDir: string,
  _platformInfo: PlatformInfo,
): Promise<InstallResult> {
  const source = pkg.source.npm!;
  const version = source.version ? `@${source.version}` : "";
  const packageSpec = `${source.package}${version}`;

  const result = await exec("npm", [
    "install",
    "--prefix",
    installDir,
    packageSpec,
  ]);

  if (result.code !== 0) {
    throw new Error(`npm install failed: ${result.stderr}`);
  }

  // Resolve binary path
  const isWindows = platform() === "win32";
  const binName = isWindows ? `${source.bin}.cmd` : source.bin;
  const binPath = join(installDir, "node_modules", ".bin", binName);

  await access(binPath).catch(() => {
    throw new Error(
      `Binary not found after install: ${binPath}. Expected bin: ${source.bin}`,
    );
  });

  return {
    binPath,
    source: "npm",
    version: source.version || "latest",
  };
}
