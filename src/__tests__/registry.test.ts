import { describe, it, expect } from "vitest";
import { loadPackage, listPackages, searchPackages } from "../core/registry.js";

describe("registry", () => {
  it("lists available packages", async () => {
    const packages = await listPackages();
    expect(packages.length).toBeGreaterThanOrEqual(5);
    expect(packages).toContain("pyright");
    expect(packages).toContain("rust-analyzer");
    expect(packages).toContain("typescript-language-server");
    expect(packages).toContain("gopls");
    expect(packages).toContain("eslint-lsp");
  });

  it("loads a package definition", async () => {
    const pkg = await loadPackage("pyright");
    expect(pkg).not.toBeNull();
    expect(pkg!.name).toBe("pyright");
    expect(pkg!.languages).toContain("python");
    expect(pkg!.source.npm).toBeDefined();
    expect(pkg!.source.npm!.package).toBe("pyright");
    expect(pkg!.lsp.command).toBe("pyright-langserver");
    expect(pkg!.lsp.args).toContain("--stdio");
  });

  it("returns null for unknown package", async () => {
    const pkg = await loadPackage("nonexistent-server-xyz");
    expect(pkg).toBeNull();
  });

  it("searches by language", async () => {
    const results = await searchPackages("python");
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some((r) => r.name === "pyright")).toBe(true);
  });

  it("searches by name", async () => {
    const results = await searchPackages("rust");
    expect(results.some((r) => r.name === "rust-analyzer")).toBe(true);
  });

  it("loads rust-analyzer with github_release source", async () => {
    const pkg = await loadPackage("rust-analyzer");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.github_release).toBeDefined();
    expect(pkg!.source.github_release!.repo).toBe("rust-lang/rust-analyzer");
    expect(pkg!.source.github_release!.assets).toBeDefined();
  });

  it("loads gopls with go source", async () => {
    const pkg = await loadPackage("gopls");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.go).toBeDefined();
    expect(pkg!.source.go!.package).toContain("golang.org");
  });
});
