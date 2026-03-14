import { join } from "node:path";
import { chmod, access, rename } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { downloadFile } from "../utils/download.js";
import type { PackageDefinition } from "../core/registry.js";
import type { PlatformInfo } from "../core/platform.js";
import type { InstallResult } from "./index.js";

export async function installBinary(
  pkg: PackageDefinition,
  installDir: string,
  platformInfo: PlatformInfo,
): Promise<InstallResult> {
  const source = pkg.source.github_release!;
  const assetName = source.assets[platformInfo.key];

  if (!assetName) {
    throw new Error(
      `No binary available for platform ${platformInfo.key}. Available: ${Object.keys(source.assets).join(", ")}`,
    );
  }

  const url = `https://github.com/${source.repo}/releases/download/${source.tag}/${assetName}`;
  const downloadPath = join(installDir, assetName);
  const binName = platformInfo.isWindows
    ? `${source.bin}.exe`
    : source.bin;
  const binPath = join(installDir, binName);

  await downloadFile(url, downloadPath);

  // Extract based on type
  if (source.extract === "gzip") {
    await extractGzip(downloadPath, binPath);
  } else if (source.extract === "zip") {
    await extractZip(downloadPath, installDir);
  } else if (source.extract === "tar.gz") {
    await extractTarGz(downloadPath, installDir);
  }
  // "none" — the download itself is the binary

  if (source.extract === "none") {
    await rename(downloadPath, binPath);
  }

  // Make executable on Unix
  if (!platformInfo.isWindows) {
    await chmod(binPath, 0o755);
  }

  await access(binPath).catch(() => {
    throw new Error(`Binary not found after extraction: ${binPath}`);
  });

  return {
    binPath,
    source: "binary",
    version: source.tag,
  };
}

async function extractGzip(src: string, dest: string): Promise<void> {
  await pipeline(
    createReadStream(src),
    createGunzip(),
    createWriteStream(dest),
  );
}

async function extractZip(
  zipPath: string,
  destDir: string,
): Promise<void> {
  // Use Node.js built-in unzip via child_process
  const { exec: execSpawn } = await import("../utils/spawn.js");
  const { platform } = await import("node:os");
  if (platform() === "win32") {
    await execSpawn("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force`,
    ]);
  } else {
    await execSpawn("unzip", ["-o", zipPath, "-d", destDir]);
  }
}

async function extractTarGz(
  tarPath: string,
  destDir: string,
): Promise<void> {
  const { exec: execSpawn } = await import("../utils/spawn.js");
  await execSpawn("tar", ["-xzf", tarPath, "-C", destDir]);
}
