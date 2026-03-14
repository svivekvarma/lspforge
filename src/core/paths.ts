import { homedir, platform } from "node:os";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";

/**
 * Get the lspforge data directory.
 * Windows: %LOCALAPPDATA%\lspforge
 * macOS:   ~/.lspforge
 * Linux:   $XDG_DATA_HOME/lspforge or ~/.local/share/lspforge
 */
export function getDataDir(): string {
  const os = platform();
  if (os === "win32") {
    return join(
      process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local"),
      "lspforge",
    );
  }
  if (os === "darwin") {
    return join(homedir(), ".lspforge");
  }
  // Linux — respect XDG
  return join(
    process.env.XDG_DATA_HOME || join(homedir(), ".local", "share"),
    "lspforge",
  );
}

export function getServersDir(): string {
  return join(getDataDir(), "servers");
}

export function getServerDir(name: string): string {
  return join(getServersDir(), name);
}

export function getStatePath(): string {
  return join(getDataDir(), "state.json");
}

/**
 * Ensure the data directory structure exists.
 */
export async function ensureDataDirs(): Promise<void> {
  await mkdir(getServersDir(), { recursive: true });
}
