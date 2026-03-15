import type { PackageSource, PackageDefinition } from "../core/registry.js";
import type { AvailableRuntimes, PlatformInfo } from "../core/platform.js";
import { installNpm } from "./npm.js";
import { installPip } from "./pip.js";
import { installCargo } from "./cargo.js";
import { installGo } from "./go.js";
import { installBinary } from "./binary.js";

export interface InstallResult {
  binPath: string;
  source: string;
  version: string;
  checksumVerified?: boolean | "skipped";
}

export type InstallerFn = (
  pkg: PackageDefinition,
  installDir: string,
  platformInfo: PlatformInfo,
) => Promise<InstallResult>;

/**
 * Select the best installer for a package given available runtimes.
 * Priority: npm > pip > cargo > go > binary
 */
export function selectInstaller(
  source: PackageSource,
  runtimes: AvailableRuntimes,
): { type: string; installer: InstallerFn } | null {
  if (source.npm && runtimes.npm) {
    return { type: "npm", installer: installNpm };
  }
  if (source.pip && runtimes.pip) {
    return { type: "pip", installer: installPip };
  }
  if (source.cargo && runtimes.cargo) {
    return { type: "cargo", installer: installCargo };
  }
  if (source.go && runtimes.go) {
    return { type: "go", installer: installGo };
  }
  if (source.github_release) {
    return { type: "binary", installer: installBinary };
  }
  return null;
}
