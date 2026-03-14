import { crossSpawn } from "../utils/spawn.js";
import { toFileUri } from "../utils/file-uri.js";
import { tmpdir } from "node:os";

export interface HealthResult {
  status: "ok" | "error" | "timeout";
  serverName: string;
  responseTimeMs: number;
  error?: string;
}

/**
 * Perform an LSP initialize handshake to verify a server is working.
 */
export async function checkLspHealth(
  serverName: string,
  binPath: string,
  args: string[],
  timeoutMs: number = 10000,
  rootDir?: string,
): Promise<HealthResult> {
  const start = Date.now();

  return new Promise<HealthResult>((resolve) => {
    let resolved = false;
    const done = (result: HealthResult) => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      resolve(result);
    };

    const proc = crossSpawn(binPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    // Suppress EPIPE errors on stdin — the server may exit before
    // we finish the shutdown sequence, which is fine.
    proc.stdin?.on("error", () => {});

    let stdout = "";
    const timer = setTimeout(() => {
      proc.kill();
      done({
        status: "timeout",
        serverName,
        responseTimeMs: Date.now() - start,
        error: `Server did not respond within ${timeoutMs}ms`,
      });
    }, timeoutMs);

    proc.on("error", (err) => {
      done({
        status: "error",
        serverName,
        responseTimeMs: Date.now() - start,
        error: `Failed to spawn: ${err.message}`,
      });
    });

    proc.stdout?.on("data", (data: Buffer) => {
      stdout += data.toString();

      // Look for a complete LSP response
      if (stdout.includes('"capabilities"')) {
        done({
          status: "ok",
          serverName,
          responseTimeMs: Date.now() - start,
        });

        // Clean shutdown — best effort, ignore errors
        try {
          safeSend(proc.stdin!, 2, "shutdown", null);
          setTimeout(() => {
            safeSend(proc.stdin!, null, "exit", undefined);
            proc.kill();
          }, 200);
        } catch {
          proc.kill();
        }
      }
    });

    proc.on("close", () => {
      done({
        status: stdout.includes('"capabilities"') ? "ok" : "error",
        serverName,
        responseTimeMs: Date.now() - start,
        error: stdout.includes('"capabilities"')
          ? undefined
          : "Server exited without responding to initialize",
      });
    });

    // Send LSP initialize request — use the install directory as rootUri
    // so the server can find co-installed packages (e.g. tsserver).
    const rootUri = toFileUri(rootDir ?? tmpdir());
    safeSend(proc.stdin!, 1, "initialize", {
      processId: process.pid,
      capabilities: {},
      rootUri,
      workspaceFolders: null,
    });
  });
}

/**
 * Send an LSP JSON-RPC message, ignoring write errors.
 */
function safeSend(
  stream: NodeJS.WritableStream,
  id: number | null,
  method: string,
  params: unknown,
): void {
  const msg: Record<string, unknown> = { jsonrpc: "2.0", method };
  if (id !== null) msg.id = id;
  if (params !== undefined) msg.params = params;

  const body = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  try {
    stream.write(header + body);
  } catch {
    // Server already exited — ignore
  }
}
