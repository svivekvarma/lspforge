import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, writeFile, access, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import type { PackageDefinition } from "../core/registry.js";
import type { PlatformInfo } from "../core/platform.js";

// Mock downloadFile and consola before importing installBinary
vi.mock("../utils/download.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../utils/download.js")>();
  return {
    ...actual,
    downloadFile: vi.fn(),
  };
});

vi.mock("consola", () => ({
  default: {
    success: vi.fn(),
    warn: vi.fn(),
  },
}));

import { installBinary } from "../installers/binary.js";
import { downloadFile, verifyChecksum } from "../utils/download.js";
import consola from "consola";

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

  it("logs warning when no checksum is provided", async () => {
    const pkg = makePkg();

    // downloadFile mock: create the fake binary file
    mockDownloadFile.mockImplementation(async (_url, destPath) => {
      await writeFile(destPath, "binary-content");
    });

    await installBinary(pkg, installDir, platformInfo);

    expect(consola.warn).toHaveBeenCalledWith(
      "No checksum available — skipping verification",
    );
  });

  it("succeeds when checksum matches", async () => {
    const content = "binary-content";
    const hash = createHash("sha256").update(content).digest("hex");
    const pkg = makePkg({ linux_x64: hash });

    mockDownloadFile.mockImplementation(async (_url, destPath) => {
      await writeFile(destPath, content);
    });

    await installBinary(pkg, installDir, platformInfo);

    expect(consola.success).toHaveBeenCalledWith("Checksum verified");
  });

  it("fails and deletes download on checksum mismatch", async () => {
    const pkg = makePkg({ linux_x64: "badhash" });

    mockDownloadFile.mockImplementation(async (_url, destPath) => {
      await writeFile(destPath, "binary-content");
    });

    await expect(
      installBinary(pkg, installDir, platformInfo),
    ).rejects.toThrow("Checksum verification failed");

    // The downloaded file should be deleted
    await expect(
      access(join(installDir, "test-bin")),
    ).rejects.toThrow();
  });

  // Clean up temp dirs
  afterEach(async () => {
    await rm(installDir, { recursive: true, force: true }).catch(() => {});
  });
});

describe("verifyChecksum utility", () => {
  it("returns true for matching hash", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-cksum-"));
    const filePath = join(dir, "testfile");
    const content = "hello world";
    const expected = createHash("sha256").update(content).digest("hex");

    await writeFile(filePath, content);
    expect(await verifyChecksum(filePath, expected)).toBe(true);

    await rm(dir, { recursive: true, force: true });
  });

  it("returns false for mismatched hash", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-cksum-"));
    const filePath = join(dir, "testfile");

    await writeFile(filePath, "hello world");
    expect(await verifyChecksum(filePath, "wronghash")).toBe(false);

    await rm(dir, { recursive: true, force: true });
  });
});
