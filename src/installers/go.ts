import { join } from "node:path";
import { platform } from "node:os";
import { access } from "node:fs/promises";
import { exec } from "../utils/spawn.js";
import type { PackageDefinition } from "../core/registry.js";
import type { PlatformInfo } from "../core/platform.js";
import type { InstallResult } from "./index.js";

export async function installGo(
  pkg: PackageDefinition,
  installDir: string,
  _platformInfo: PlatformInfo,
): Promise<InstallResult> {
  const source = pkg.source.go!;
  const version = source.version ? `@${source.version}` : "@latest";
  const packageSpec = `${source.package}${version}`;
  const goBinDir = join(installDir, "bin");

  const result = await exec("go", ["install", packageSpec], {
    env: { ...process.env, GOBIN: goBinDir },
  });

  if (result.code !== 0) {
    throw new Error(`go install failed: ${result.stderr}`);
  }

  const isWindows = platform() === "win32";
  const binName = isWindows ? `${source.bin}.exe` : source.bin;
  const binPath = join(goBinDir, binName);

  await access(binPath).catch(() => {
    throw new Error(`Binary not found after install: ${binPath}`);
  });

  return {
    binPath,
    source: "go",
    version: source.version || "latest",
  };
}
