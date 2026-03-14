import { platform, arch, homedir } from "node:os";
import { commandExists } from "../utils/spawn.js";

export type Platform = "win32" | "darwin" | "linux";
export type Arch = "x64" | "arm64";
export type PlatformKey =
  | "win_x64"
  | "win_arm64"
  | "darwin_x64"
  | "darwin_arm64"
  | "linux_x64"
  | "linux_arm64";

export interface PlatformInfo {
  os: Platform;
  arch: Arch;
  key: PlatformKey;
  isWindows: boolean;
}

export function detectPlatform(): PlatformInfo {
  const os = platform() as Platform;
  const a = arch() === "arm64" ? "arm64" : "x64";
  const osPrefix = os === "win32" ? "win" : os;
  const key = `${osPrefix}_${a}` as PlatformKey;

  return {
    os,
    arch: a as Arch,
    key,
    isWindows: os === "win32",
  };
}

export interface AvailableRuntimes {
  npm: boolean;
  python: boolean;
  pip: boolean;
  cargo: boolean;
  go: boolean;
}

/**
 * Detect which package manager runtimes are available on PATH.
 */
export async function detectRuntimes(): Promise<AvailableRuntimes> {
  const [npm, python, pip, cargo, go] = await Promise.all([
    commandExists("npm"),
    commandExists("python3").then((v) =>
      v ? v : commandExists("python"),
    ),
    commandExists("pip3").then((v) => (v ? v : commandExists("pip"))),
    commandExists("cargo"),
    commandExists("go"),
  ]);

  return { npm, python, pip, cargo, go };
}
