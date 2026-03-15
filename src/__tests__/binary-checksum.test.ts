import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import type { PackageDefinition } from "../core/registry.js";
import type { PlatformInfo } from "../core/platform.js";

// Mock downloadFile before importing installBinary
vi.mock("../utils/download.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/download.js")>();
  return {
    ...actual,
    downloadFile: vi.fn(),
  };
});

import { installBinary } from "../installers/binary.js";
import { downloadFile, verifyChecksum } from "../utils/download.js";

const mockDownloadFile = vi.mocked(downloadFile);

const platformInfo: PlatformInfo = {
  os: "linux",
  arch: "x64",
  key: "linux_x64",
  isWindows: false,
};

function makePkg(checksums?: Record<string, string>): PackageDefinition {
  return {
    name: "test-bin",
    description: "test",
    languages: ["test"],
    source: {
      github_release: {
        repo: "test/test",
        tag: "v1.0",
        assets: { linux_x64: "test-bin" },
        checksums,
        bin: "test-bin",
        extract: "none",
      },
    },
    lsp: {
      command: "test-bin",
      args: [],
      file_patterns: ["**/*.test"],
      extension_to_language: { ".test": "test" },
    },
  };
}

describe("installBinary checksum verification", () => {
  let installDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    installDir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
  });

  afterEach(async () => {
    await rm(installDir, { recursive: true, force: true }).catch(() => {});
  });

  it("returns checksumVerified as skipped when no checksum is provided", async () => {
    const pkg = makePkg();

    mockDownloadFile.mockImplementation(async (_url, destPath) => {
      await writeFile(destPath, "binary-content");
    });

    const result = await installBinary(pkg, installDir, platformInfo);

    expect(result.checksumVerified).toBe("skipped");
  });

  it("returns checksumVerified as true when checksum matches", async () => {
    const content = "binary-content";
    const hash = createHash("sha256").update(content).digest("hex");
    const pkg = makePkg({ linux_x64: hash });

    mockDownloadFile.mockImplementation(async (_url, destPath) => {
      await writeFile(destPath, content);
    });

    const result = await installBinary(pkg, installDir, platformInfo);

    expect(result.checksumVerified).toBe(true);
  });

  it("fails and deletes download on checksum mismatch", async () => {
    const pkg = makePkg({ linux_x64: "badhash" });

    mockDownloadFile.mockImplementation(async (_url, destPath) => {
      await writeFile(destPath, "binary-content");
    });

    await expect(
      installBinary(pkg, installDir, platformInfo),
    ).rejects.toThrow("Checksum verification failed for test-bin");

    // The downloaded file should be deleted
    await expect(
      access(join(installDir, "test-bin")),
    ).rejects.toThrow();
  });
});

describe("verifyChecksum utility", () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "lspforge-cksum-"));
    filePath = join(dir, "testfile");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("returns true for matching hash", async () => {
    const content = "hello world";
    const expected = createHash("sha256").update(content).digest("hex");

    await writeFile(filePath, content);
    expect(await verifyChecksum(filePath, expected)).toBe(true);
  });

  it("returns false for mismatched hash", async () => {
    await writeFile(filePath, "hello world");
    expect(await verifyChecksum(filePath, "wronghash")).toBe(false);
  });
});
