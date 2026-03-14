import { platform } from "node:os";

/**
 * Convert a filesystem path to a proper file:// URI.
 * Windows: C:\foo\bar → file:///C:/foo/bar
 * Unix:    /foo/bar   → file:///foo/bar
 */
export function toFileUri(fsPath: string): string {
  if (platform() === "win32") {
    const normalized = fsPath.replace(/\\/g, "/");
    return `file:///${normalized}`;
  }
  return `file://${fsPath}`;
}
