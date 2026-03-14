import { describe, it, expect } from "vitest";
import { deepMerge, mergeJsonConfig } from "../utils/json-merge.js";
import { join } from "node:path";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

describe("deepMerge", () => {
  it("merges flat objects", () => {
    const result = deepMerge({ a: 1 }, { b: 2 });
    expect(result).toEqual({ a: 1, b: 2 });
  });

  it("overwrites existing keys", () => {
    const result = deepMerge({ a: 1 }, { a: 2 });
    expect(result).toEqual({ a: 2 });
  });

  it("deep merges nested objects", () => {
    const result = deepMerge(
      { a: { x: 1, y: 2 } },
      { a: { y: 3, z: 4 } },
    );
    expect(result).toEqual({ a: { x: 1, y: 3, z: 4 } });
  });

  it("preserves existing nested keys not in source", () => {
    const result = deepMerge(
      { servers: { existing: { cmd: "foo" } } },
      { servers: { newServer: { cmd: "bar" } } },
    );
    expect(result).toEqual({
      servers: {
        existing: { cmd: "foo" },
        newServer: { cmd: "bar" },
      },
    });
  });
});

describe("mergeJsonConfig", () => {
  it("creates file if it doesn't exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    const filePath = join(dir, "config.json");
    try {
      await mergeJsonConfig(filePath, { key: "value" });
      const content = JSON.parse(await readFile(filePath, "utf-8"));
      expect(content).toEqual({ key: "value" });
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("merges into existing file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    const filePath = join(dir, "config.json");
    try {
      await writeFile(filePath, JSON.stringify({ existing: true }, null, 2));
      await mergeJsonConfig(filePath, { added: true });
      const content = JSON.parse(await readFile(filePath, "utf-8"));
      expect(content).toEqual({ existing: true, added: true });
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("creates parent directories if they don't exist", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    const filePath = join(dir, "nested", "deep", "config.json");
    try {
      await mergeJsonConfig(filePath, { key: "value" });
      const content = JSON.parse(await readFile(filePath, "utf-8"));
      expect(content).toEqual({ key: "value" });
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("preserves indent style", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    const filePath = join(dir, "config.json");
    try {
      await writeFile(filePath, JSON.stringify({ a: 1 }, null, 4));
      await mergeJsonConfig(filePath, { b: 2 });
      const raw = await readFile(filePath, "utf-8");
      expect(raw).toContain("    ");
    } finally {
      await rm(dir, { recursive: true });
    }
  });
});
