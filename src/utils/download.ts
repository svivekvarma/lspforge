import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { ofetch } from "ofetch";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";

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
 * Verify a file's SHA-256 checksum using streaming to stay O(1) memory.
 */
export async function verifyChecksum(
  filePath: string,
  expectedSha256: string,
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex") === expectedSha256));
    stream.on("error", reject);
  });
}
