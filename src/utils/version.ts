/**
 * Compare two version strings.
 * Handles semver-like versions (e.g. "1.2.3") and tag strings (e.g. "2024-01-01").
 * Returns:
 *   -1 if a < b
 *    0 if a === b
 *    1 if a > b
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  if (a === b) return 0;

  // Split on dots, hyphens, or underscores to handle semver and date tags
  const partsA = a.replace(/^v/, "").split(/[.\-_]/);
  const partsB = b.replace(/^v/, "").split(/[.\-_]/);
  const len = Math.max(partsA.length, partsB.length);

  for (let i = 0; i < len; i++) {
    const rawA = partsA[i] ?? "0";
    const rawB = partsB[i] ?? "0";
    const numA = parseInt(rawA, 10);
    const numB = parseInt(rawB, 10);

    // Both purely numeric — compare as numbers
    if (!isNaN(numA) && !isNaN(numB) && String(numA) === rawA && String(numB) === rawB) {
      if (numA < numB) return -1;
      if (numA > numB) return 1;
      continue;
    }

    // Fallback to string comparison
    if (rawA < rawB) return -1;
    if (rawA > rawB) return 1;
  }

  return 0;
}

/**
 * Check if version `b` is newer than version `a`.
 */
export function isNewer(installed: string, registry: string): boolean {
  return compareVersions(installed, registry) < 0;
}
