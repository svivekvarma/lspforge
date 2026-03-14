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
      expect(py.recommendedServers).toContain("ruff");
      expect(py.recommendedServers).toContain("python-lsp-server");
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

  it("detects Lua from .lua files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "init.lua"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "lua")).toBe(true);
      const lua = result.find((r) => r.language === "lua")!;
      expect(lua.recommendedServers).toContain("lua-language-server");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects YAML from .yaml files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "config.yaml"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "yaml")).toBe(true);
      const yaml = result.find((r) => r.language === "yaml")!;
      expect(yaml.recommendedServers).toContain("yaml-language-server");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects YAML from .yml files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "ci.yml"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "yaml")).toBe(true);
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects TOML from .toml files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "settings.toml"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "toml")).toBe(true);
      const toml = result.find((r) => r.language === "toml")!;
      expect(toml.recommendedServers).toContain("taplo");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects Bash from .sh files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "build.sh"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "bash")).toBe(true);
      const bash = result.find((r) => r.language === "bash")!;
      expect(bash.recommendedServers).toContain("bash-language-server");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects CSS from .css files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "styles.css"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "css")).toBe(true);
      const css = result.find((r) => r.language === "css")!;
      expect(css.recommendedServers).toContain("css-lsp");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects HTML from .html files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "index.html"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "html")).toBe(true);
      const html = result.find((r) => r.language === "html")!;
      expect(html.recommendedServers).toContain("html-lsp");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects Templ from .templ files", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "page.templ"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "templ")).toBe(true);
      const templ = result.find((r) => r.language === "templ")!;
      expect(templ.recommendedServers).toContain("templ");
    } finally {
      await rm(dir, { recursive: true });
    }
  });

  it("detects C++ from CMakeLists.txt", async () => {
    const dir = await mkdtemp(join(tmpdir(), "lspforge-test-"));
    try {
      await writeFile(join(dir, "CMakeLists.txt"), "");
      const result = await detectLanguages(dir);
      expect(result.some((r) => r.language === "cpp")).toBe(true);
      const cpp = result.find((r) => r.language === "cpp")!;
      expect(cpp.recommendedServers).toContain("clangd");
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
