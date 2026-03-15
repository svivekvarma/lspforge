import { join } from "node:path";
import { chmod, access, rename } from "node:fs/promises";
import { createGunzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { downloadFile, verifyChecksum } from "../utils/download.js";
import { unlink } from "node:fs/promises";
import consola from "consola";
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

  // Verify checksum if available
  const expectedChecksum = source.checksums?.[platformInfo.key];
  if (expectedChecksum) {
    const valid = await verifyChecksum(downloadPath, expectedChecksum);
    if (!valid) {
      await unlink(downloadPath);
      throw new Error(
        `Checksum verification failed for ${assetName}. The download has been deleted.`,
      );
    }
    consola.success("Checksum verified");
  } else {
    consola.warn("No checksum available — skipping verification");
  }

  // Determine extraction method: infer from asset filename, falling back to
  // the explicit `extract` field. This handles cases like rust-analyzer where
  // Linux assets are .gz but the Windows asset is .zip.
  const extractType = inferExtractType(assetName) ?? source.extract;

  if (extractType === "gzip") {
    await extractGzip(downloadPath, binPath);
  } else if (extractType === "zip") {
    await extractZip(downloadPath, installDir);
  } else if (extractType === "tar.gz") {
    await extractTarGz(downloadPath, installDir);
  }
  // "none" — the download itself is the binary

  if (extractType === "none") {
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

/**
 * Infer extraction type from the asset filename extension.
 * Returns null if the extension doesn't map to a known type.
 */
function inferExtractType(filename: string): "gzip" | "zip" | "tar.gz" | "none" | null {
  if (filename.endsWith(".tar.gz") || filename.endsWith(".tgz")) return "tar.gz";
  if (filename.endsWith(".zip")) return "zip";
  if (filename.endsWith(".gz")) return "gzip";
  return null;
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
