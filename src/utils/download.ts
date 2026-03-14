import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ofetch } from "ofetch";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

/**
 * Download a file from a URL to a local path.
 */
export async function downloadFile(
  url: string,
  destPath: string,
): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });

  const response = await ofetch.raw(url, { responseType: "stream" });
  const body = response._data as ReadableStream;
  const nodeStream = Readable.fromWeb(body as never);
  const fileStream = createWriteStream(destPath);
  await pipeline(nodeStream, fileStream);
}

/**
 * Verify a file's SHA-256 checksum.
 */
export async function verifyChecksum(
  filePath: string,
  expectedSha256: string,
): Promise<boolean> {
  const content = await readFile(filePath);
  const hash = createHash("sha256").update(content).digest("hex");
  return hash === expectedSha256;
}
