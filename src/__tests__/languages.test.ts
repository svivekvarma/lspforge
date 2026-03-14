import { describe, it, expect } from "vitest";
import { detectLanguages } from "../detect/languages.js";
import { join } from "node:path";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("detectLanguages", () => {
  it("detects TypeScript from tsconfig.json", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "tsconfig.json"), "{}");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "typescript")).toBe(true);
      const ts = result.find((r) => r.language === "typescript")!;
      expect(ts.confidence).toBe("certain");
      expect(ts.recommendedServers).toContain("typescript-language-server");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects Python from pyproject.toml", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "pyproject.toml"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "python")).toBe(true);
      const py = result.find((r) => r.language === "python")!;
      expect(py.recommendedServers).toContain("pyright");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects Rust from Cargo.toml", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "Cargo.toml"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "rust")).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects Go from go.mod", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "go.mod"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "go")).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects multiple languages", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "tsconfig.json"), "{}");
      await writeFile(join(dir, "pyproject.toml"), "");
      const result = await detectLanguages(dir);
      expect(result.length).toBeGreaterThanOrEqual(2);
      expect(result.some((r) => r.language === "typescript")).toBe(true);
      expect(result.some((r) => r.language === "python")).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("returns empty for empty directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      const result = await detectLanguages(dir);
      expect(result).toEqual([]);
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
