# CLAUDE.md — Project Context for AI Assistants

## Project Overview

This is **lspforge** — an npm CLI package that installs, manages, and configures LSP servers for AI coding tools (Claude Code, GitHub Copilot CLI, OpenAI Codex, Gemini CLI, VS Code Copilot).

Think "mason.nvim but for AI coding tools instead of Neovim."

## Key Documents

- `SOUL.md` — Project vision, problem statement, gap analysis, core principles
- `RESEARCH.md` — Market research, competitive landscape, pain points from GitHub issues
- `ARCHITECTURE.md` — Technical architecture, source structure, registry schema, install pipeline

## Project Stage

**Early development** — Architecture defined, building MVP.

## Tech Stack

- **Runtime**: Node.js 20+
- **Language**: TypeScript (strict, ESM)
- **CLI framework**: citty (UnJS)
- **Build**: tsup (esbuild)
- **Test**: vitest
- **Package**: Published to npm as `lspforge`

## MVP Scope

- **Clients**: Claude Code, GitHub Copilot CLI, OpenAI Codex
- **Installers**: npm, pip, cargo, go, binary downloads
- **Servers**: 5-10 bundled (typescript-ls, pyright, rust-analyzer, gopls, eslint-lsp)

## Key Design Decisions

1. CLI-first — not a VS Code extension, not a web app
2. npm package: `npm install -g lspforge`
3. Windows as a first-class citizen
4. Sandboxed server installs in `~/.lspforge/servers/`
5. Bundled registry (YAML) — separate repo later
6. Tag managed config entries with `_managed_by: lspforge`

## Conventions

- TypeScript strict mode, ESM modules
- Minimal dependencies (~7 runtime deps)
- Cross-platform code paths tested
- consola for logging, ofetch for HTTP
