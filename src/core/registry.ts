import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

export interface PackageSource {
  npm?: { package: string; bin: string; version?: string };
  pip?: { package: string; bin: string; version?: string };
  cargo?: { package: string; bin: string; version?: string };
  go?: { package: string; bin: string; version?: string };
  github_release?: {
    repo: string;
    tag: string;
    assets: Record<string, string>;
    bin: string;
    extract: "gzip" | "zip" | "tar.gz" | "none";
  };
}

export interface PackageLsp {
  command: string;
  args: string[];
  file_patterns: string[];
}

export interface PackagePlatformOverride {
  spawn_shell?: boolean;
}

export interface PackageHealth {
  timeout_ms: number;
}

export interface PackageDefinition {
  name: string;
  description: string;
  languages: string[];
  source: PackageSource;
  lsp: PackageLsp;
  platforms?: Record<string, PackagePlatformOverride>;
  health?: PackageHealth;
}

/**
 * Get the path to the bundled registry directory.
 * Tries multiple relative paths since tsup may code-split.
 */
function getRegistryDir(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const dir = dirname(thisFile);

  // Try common locations relative to where code runs from
  const candidates = [
    join(dir, "..", "registry"),       // dist/chunk.js → ../registry
    join(dir, "registry"),             // dist/ → registry (if flat)
    join(dir, "..", "..", "registry"), // src/core/registry.ts → ../../registry
  ];

  // Also try from process.cwd() as fallback
  candidates.push(join(process.cwd(), "registry"));

  for (const candidate of candidates) {
    if (existsSync(join(candidate, "packages"))) {
      return candidate;
    }
  }

  // Default fallback
  return join(dir, "..", "registry");
}

/**
 * Load a single package definition from the registry.
 */
export async function loadPackage(
  name: string,
): Promise<PackageDefinition | null> {
  const registryDir = getRegistryDir();
  const packagePath = join(registryDir, "packages", name, "package.yaml");
  try {
    const content = await readFile(packagePath, "utf-8");
    return yaml.load(content) as PackageDefinition;
  } catch {
    return null;
  }
}

/**
 * List all available packages in the registry.
 */
export async function listPackages(): Promise<string[]> {
  const registryDir = getRegistryDir();
  const packagesDir = join(registryDir, "packages");
  try {
    const entries = await readdir(packagesDir, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/**
 * Load all package definitions.
 */
export async function loadAllPackages(): Promise<PackageDefinition[]> {
  const names = await listPackages();
  const packages = await Promise.all(names.map(loadPackage));
  return packages.filter((p): p is PackageDefinition => p !== null);
}

/**
 * Search packages by name or language.
 */
export async function searchPackages(
  query: string,
): Promise<PackageDefinition[]> {
  const all = await loadAllPackages();
  const q = query.toLowerCase();
  return all.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.languages.some((l) => l.toLowerCase().includes(q)),
  );
}
