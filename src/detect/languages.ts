import { readdir } from "node:fs/promises";

interface LanguageDetection {
  language: string;
  confidence: "certain" | "high" | "medium";
}

const FILE_INDICATORS: Record<string, LanguageDetection> = {
  "tsconfig.json": { language: "typescript", confidence: "certain" },
  "jsconfig.json": { language: "javascript", confidence: "certain" },
  "package.json": { language: "typescript", confidence: "medium" },
  "Cargo.toml": { language: "rust", confidence: "certain" },
  "go.mod": { language: "go", confidence: "certain" },
  "pyproject.toml": { language: "python", confidence: "high" },
  "requirements.txt": { language: "python", confidence: "high" },
  "setup.py": { language: "python", confidence: "high" },
  "Pipfile": { language: "python", confidence: "high" },
  "Gemfile": { language: "ruby", confidence: "certain" },
  "pom.xml": { language: "java", confidence: "certain" },
  "build.gradle": { language: "java", confidence: "high" },
  "build.gradle.kts": { language: "kotlin", confidence: "high" },
  "composer.json": { language: "php", confidence: "certain" },
  "mix.exs": { language: "elixir", confidence: "certain" },
  "Makefile": { language: "c", confidence: "medium" },
  "CMakeLists.txt": { language: "cpp", confidence: "high" },
};

const EXTENSION_INDICATORS: Record<string, string> = {
  ".cs": "csharp",
  ".csproj": "csharp",
  ".sln": "csharp",
  ".java": "java",
  ".fs": "fsharp",
  ".dart": "dart",
  ".swift": "swift",
  ".kt": "kotlin",
  ".scala": "scala",
  ".zig": "zig",
  ".lua": "lua",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".sh": "bash",
  ".bash": "bash",
  ".css": "css",
  ".scss": "css",
  ".less": "css",
  ".html": "html",
  ".htm": "html",
  ".templ": "templ",
};

const LANGUAGE_TO_SERVERS: Record<string, string[]> = {
  typescript: ["typescript-language-server"],
  javascript: ["typescript-language-server"],
  python: ["pyright", "ruff", "python-lsp-server"],
  rust: ["rust-analyzer"],
  go: ["gopls"],
  csharp: ["omnisharp"],
  java: ["eclipse-jdt-ls"],
  kotlin: ["kotlin-language-server"],
  ruby: ["solargraph"],
  php: ["intelephense"],
  elixir: ["elixir-ls"],
  c: ["clangd"],
  cpp: ["clangd"],
  lua: ["lua-language-server"],
  yaml: ["yaml-language-server"],
  toml: ["taplo"],
  bash: ["bash-language-server"],
  css: ["css-lsp"],
  html: ["html-lsp"],
  templ: ["templ"],
};

export interface DetectedLanguage {
  language: string;
  confidence: "certain" | "high" | "medium";
  recommendedServers: string[];
}

/**
 * Scan a project directory to detect languages in use.
 * Only reads the top-level directory — no deep traversal.
 */
export async function detectLanguages(
  projectDir: string,
): Promise<DetectedLanguage[]> {
  const entries = await readdir(projectDir);
  const seen = new Map<string, LanguageDetection>();

  for (const entry of entries) {
    // Check exact file name matches
    const indicator = FILE_INDICATORS[entry];
    if (indicator) {
      const existing = seen.get(indicator.language);
      if (
        !existing ||
        confidenceRank(indicator.confidence) >
          confidenceRank(existing.confidence)
      ) {
        seen.set(indicator.language, indicator);
      }
    }

    // Check extension matches
    for (const [ext, language] of Object.entries(EXTENSION_INDICATORS)) {
      if (entry.endsWith(ext)) {
        if (!seen.has(language)) {
          seen.set(language, { language, confidence: "high" });
        }
      }
    }
  }

  return Array.from(seen.values()).map((det) => ({
    ...det,
    recommendedServers: LANGUAGE_TO_SERVERS[det.language] || [],
  }));
}

function confidenceRank(c: "certain" | "high" | "medium"): number {
  return c === "certain" ? 3 : c === "high" ? 2 : 1;
}
