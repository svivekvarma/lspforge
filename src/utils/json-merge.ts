import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

/**
 * Deep merge source into target, preserving existing keys.
 * Only overwrites keys present in source.
 */
export function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];
    if (
      isPlainObject(targetVal) &&
      isPlainObject(sourceVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>,
      );
    } else {
      result[key] = sourceVal;
    }
  }
  return result;
}

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return typeof val === "object" && val !== null && !Array.isArray(val);
}

/**
 * Read a JSON config file, merge new entries, write back preserving formatting.
 */
export async function mergeJsonConfig(
  filePath: string,
  updates: Record<string, unknown>,
): Promise<void> {
  let existing: Record<string, unknown> = {};
  let indent = 2;

  try {
    const content = await readFile(filePath, "utf-8");
    existing = JSON.parse(content);
    // Detect indent style
    const match = content.match(/^(\s+)"/m);
    if (match) {
      indent = match[1].includes("\t") ? 1 : match[1].length;
    }
  } catch {
    // File doesn't exist or is invalid — start fresh
  }

  const merged = deepMerge(existing, updates);
  const useTab = indent === 1;
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    JSON.stringify(merged, null, useTab ? "\t" : indent) + "\n",
    "utf-8",
  );
}
