import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { platform } from "node:os";

export interface SpawnResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Cross-platform spawn wrapper.
 * On Windows, detects .cmd/.bat wrappers and uses shell: true.
 */
export function crossSpawn(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
): ChildProcess {
  const isWindows = platform() === "win32";

  // On Windows, always use shell mode — most tools (npm, pip, cargo)
  // are .cmd shims that can't be spawned directly.
  if (isWindows && !options.shell) {
    // Pass args as a single pre-joined string to avoid the DEP0190 warning
    const escaped = args.map((a) =>
      a.includes(" ") ? `"${a}"` : a,
    );
    return spawn(`${command} ${escaped.join(" ")}`, [], {
      ...options,
      shell: true,
    });
  }

  return spawn(command, args, {
    ...options,
  });
}

/**
 * Run a command and collect stdout/stderr.
 */
export function exec(
  command: string,
  args: string[] = [],
  options: SpawnOptions = {},
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = crossSpawn(command, args, {
      ...options,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr?.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("error", (err) => {
      resolve({ code: 1, stdout: "", stderr: err.message });
    });

    proc.on("close", (code) => {
      resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

/**
 * Check if a command exists on PATH.
 */
export async function commandExists(command: string): Promise<boolean> {
  const isWindows = platform() === "win32";
  const which = isWindows ? "where" : "which";
  try {
    const result = await exec(which, [command]);
    return result.code === 0;
  } catch {
    return false;
  }
}
