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
): Promise<HealthResult> {
  const start = Date.now();

  return new Promise<HealthResult>((resolve) => {
    const proc = crossSpawn(binPath, args, {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    const timer = setTimeout(() => {
      proc.kill();
      resolve({
        status: "timeout",
        serverName,
        responseTimeMs: Date.now() - start,
        error: `Server did not respond within ${timeoutMs}ms`,
      });
    }, timeoutMs);

    proc.on("error", (err) => {
      clearTimeout(timer);
      resolve({
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
        clearTimeout(timer);
        // Send shutdown
        sendLspRequest(proc.stdin!, 2, "shutdown", null);
        setTimeout(() => {
          sendLspNotification(proc.stdin!, "exit");
          proc.kill();
        }, 500);

        resolve({
          status: "ok",
          serverName,
          responseTimeMs: Date.now() - start,
        });
      }
    });

    proc.on("close", () => {
      clearTimeout(timer);
      if (!stdout.includes('"capabilities"')) {
        resolve({
          status: "error",
          serverName,
          responseTimeMs: Date.now() - start,
          error: "Server exited without responding to initialize",
        });
      }
    });

    // Send LSP initialize request
    const rootUri = toFileUri(tmpdir());
    sendLspRequest(proc.stdin!, 1, "initialize", {
      processId: process.pid,
      capabilities: {},
      rootUri,
      workspaceFolders: null,
    });
  });
}

function sendLspRequest(
  stream: NodeJS.WritableStream,
  id: number,
  method: string,
  params: unknown,
): void {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id,
    method,
    params,
  });
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  stream.write(header + body);
}

function sendLspNotification(
  stream: NodeJS.WritableStream,
  method: string,
): void {
  const body = JSON.stringify({
    jsonrpc: "2.0",
    method,
  });
  const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;
  stream.write(header + body);
}
