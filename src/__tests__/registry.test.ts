import { describe, it, expect } from "vitest";
import { loadPackage, listPackages, searchPackages, loadAllPackages } from "../core/registry.js";

describe("registry", () => {
  const ALL_PACKAGES = [
    "pyright",
    "rust-analyzer",
    "typescript-language-server",
    "gopls",
    "eslint-lsp",
    "ruff",
    "python-lsp-server",
    "taplo",
    "lua-language-server",
    "clangd",
    "yaml-language-server",
    "bash-language-server",
    "templ",
    "css-lsp",
    "html-lsp",
  ];

  it("lists all packages", async () => {
    const packages = await listPackages();
    expect(packages.length).toBeGreaterThanOrEqual(ALL_PACKAGES.length);
    for (const name of ALL_PACKAGES) {
      expect(packages).toContain(name);
    }
  });

  it("loads all package definitions without errors", async () => {
    const all = await loadAllPackages();
    expect(all.length).toBeGreaterThanOrEqual(ALL_PACKAGES.length);
    for (const pkg of all) {
      expect(pkg.name).toBeTruthy();
      expect(pkg.description).toBeTruthy();
      expect(pkg.languages.length).toBeGreaterThan(0);
      expect(pkg.lsp.command).toBeTruthy();
      expect(pkg.lsp.file_patterns.length).toBeGreaterThan(0);
      expect(Object.keys(pkg.lsp.extension_to_language).length).toBeGreaterThan(0);
    }
  });

  it("returns null for unknown package", async () => {
    const pkg = await loadPackage("nonexistent-server-xyz");
    expect(pkg).toBeNull();
  });

  // --- npm source packages ---

  it("loads pyright with npm + pip sources", async () => {
    const pkg = await loadPackage("pyright");
    expect(pkg).not.toBeNull();
    expect(pkg!.name).toBe("pyright");
    expect(pkg!.languages).toContain("python");
    expect(pkg!.source.npm).toBeDefined();
    expect(pkg!.source.npm!.package).toBe("pyright");
    expect(pkg!.source.pip).toBeDefined();
    expect(pkg!.source.pip!.package).toBe("pyright");
    expect(pkg!.lsp.command).toBe("pyright-langserver");
    expect(pkg!.lsp.args).toContain("--stdio");
  });

  it("loads typescript-language-server with npm source and extra_packages", async () => {
    const pkg = await loadPackage("typescript-language-server");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.npm).toBeDefined();
    expect(pkg!.source.npm!.extra_packages).toContain("typescript");
  });

  it("loads yaml-language-server with npm source", async () => {
    const pkg = await loadPackage("yaml-language-server");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.npm).toBeDefined();
    expect(pkg!.languages).toContain("yaml");
  });

  it("loads bash-language-server with npm source", async () => {
    const pkg = await loadPackage("bash-language-server");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.npm).toBeDefined();
    expect(pkg!.languages).toContain("bash");
  });

  it("loads css-lsp with npm source", async () => {
    const pkg = await loadPackage("css-lsp");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.npm).toBeDefined();
    expect(pkg!.languages).toContain("css");
  });

  it("loads html-lsp with npm source", async () => {
    const pkg = await loadPackage("html-lsp");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.npm).toBeDefined();
    expect(pkg!.languages).toContain("html");
  });

  // --- pip source packages ---

  it("loads python-lsp-server with pip-only source", async () => {
    const pkg = await loadPackage("python-lsp-server");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.pip).toBeDefined();
    expect(pkg!.source.pip!.package).toBe("python-lsp-server");
    expect(pkg!.source.pip!.bin).toBe("pylsp");
    expect(pkg!.source.npm).toBeUndefined();
    expect(pkg!.source.cargo).toBeUndefined();
  });

  it("loads ruff with pip + cargo sources", async () => {
    const pkg = await loadPackage("ruff");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.pip).toBeDefined();
    expect(pkg!.source.pip!.package).toBe("ruff");
    expect(pkg!.source.cargo).toBeDefined();
    expect(pkg!.source.cargo!.package).toBe("ruff");
    expect(pkg!.languages).toContain("python");
    expect(pkg!.lsp.command).toBe("ruff");
    expect(pkg!.lsp.args).toContain("server");
  });

  // --- cargo source packages ---

  it("loads taplo with cargo + npm sources", async () => {
    const pkg = await loadPackage("taplo");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.cargo).toBeDefined();
    expect(pkg!.source.cargo!.package).toBe("taplo-cli");
    expect(pkg!.source.npm).toBeDefined();
    expect(pkg!.languages).toContain("toml");
    expect(pkg!.lsp.args).toEqual(["lsp", "stdio"]);
  });

  // --- go source packages ---

  it("loads gopls with go source", async () => {
    const pkg = await loadPackage("gopls");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.go).toBeDefined();
    expect(pkg!.source.go!.package).toContain("golang.org");
  });

  it("loads templ with go source", async () => {
    const pkg = await loadPackage("templ");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.go).toBeDefined();
    expect(pkg!.source.go!.package).toContain("github.com/a-h/templ");
    expect(pkg!.languages).toContain("templ");
  });

  // --- github_release (binary) source packages ---

  it("loads rust-analyzer with github_release source", async () => {
    const pkg = await loadPackage("rust-analyzer");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.github_release).toBeDefined();
    expect(pkg!.source.github_release!.repo).toBe("rust-lang/rust-analyzer");
    expect(pkg!.source.github_release!.assets).toBeDefined();
    expect(pkg!.source.github_release!.extract).toBe("gzip");
  });

  it("loads lua-language-server with github_release source (tar.gz)", async () => {
    const pkg = await loadPackage("lua-language-server");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.github_release).toBeDefined();
    expect(pkg!.source.github_release!.repo).toBe("LuaLS/lua-language-server");
    expect(pkg!.source.github_release!.extract).toBe("tar.gz");
    expect(pkg!.source.github_release!.assets.linux_x64).toBeTruthy();
    expect(pkg!.source.github_release!.assets.win_x64).toBeTruthy();
    expect(pkg!.languages).toContain("lua");
  });

  it("loads clangd with github_release source (zip)", async () => {
    const pkg = await loadPackage("clangd");
    expect(pkg).not.toBeNull();
    expect(pkg!.source.github_release).toBeDefined();
    expect(pkg!.source.github_release!.repo).toBe("clangd/clangd");
    expect(pkg!.source.github_release!.extract).toBe("zip");
    expect(pkg!.languages).toEqual(expect.arrayContaining(["c", "cpp"]));
  });

  // --- search ---

  it("searches by language", async () => {
    const results = await searchPackages("python");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.some((r) => r.name === "pyright")).toBe(true);
    expect(results.some((r) => r.name === "ruff")).toBe(true);
    expect(results.some((r) => r.name === "python-lsp-server")).toBe(true);
  });

  it("searches by name", async () => {
    const results = await searchPackages("rust");
    expect(results.some((r) => r.name === "rust-analyzer")).toBe(true);
  });

  it("searches by description", async () => {
    const results = await searchPackages("linter");
    expect(results.some((r) => r.name === "ruff")).toBe(true);
  });

  // --- platform overrides ---

  it("has win32 spawn_shell override where needed", async () => {
    const npmServers = ["typescript-language-server", "eslint-lsp", "pyright", "yaml-language-server", "bash-language-server", "css-lsp", "html-lsp", "taplo"];
    for (const name of npmServers) {
      const pkg = await loadPackage(name);
      expect(pkg).not.toBeNull();
      if (pkg!.source.npm) {
        expect(pkg!.platforms?.win32?.spawn_shell).toBe(true);
      }
    }
  });

  // --- every source type has at least one package ---

  it("covers all five installer types across the registry", async () => {
    const all = await loadAllPackages();
    const hasNpm = all.some((p) => p.source.npm);
    const hasPip = all.some((p) => p.source.pip);
    const hasCargo = all.some((p) => p.source.cargo);
    const hasGo = all.some((p) => p.source.go);
    const hasBinary = all.some((p) => p.source.github_release);
    expect(hasNpm).toBe(true);
    expect(hasPip).toBe(true);
    expect(hasCargo).toBe(true);
    expect(hasGo).toBe(true);
    expect(hasBinary).toBe(true);
  });
});
