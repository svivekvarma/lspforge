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

- **Clients**: Claude Code (native LSP plugin), GitHub Copilot CLI (native LSP config), OpenAI Codex (MCP fallback)
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

## Development Workflow

Every piece of work (feature, fix, chore) follows this process:

1. **Create a GitHub issue** for the work item
2. **Create a branch** from `main` (e.g. `feat/foo`, `fix/bar`, `chore/baz`)
3. **Develop and iterate** on the branch
4. **Run tests and validate** (`npm run typecheck && npm run build && npx vitest run`)
5. **Push to the remote branch**
6. **Create a PR** linked to the issue
7. **Wait for CI to pass** — do NOT merge with failing checks
8. **Squash and merge** once CI is green
9. **Update and close the issue**
10. **Feature docs** go in `features/<feature-name>/` (one folder per feature, multiple artifacts allowed)
11. **After merge**, move the feature folder to `features/archive/` via a `docs:` PR

## Commit Conventions

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` — new feature
- `fix:` — bug fix
- `docs:` — documentation only changes
- `chore:` — maintenance, tooling, CI
- `refactor:` — code change that neither fixes a bug nor adds a feature
- `test:` — adding or updating tests

**Authorship**: All commits MUST be authored by `svivekvarma`. AI assistants (Claude, Copilot, etc.) must NEVER be the commit author or co-author. Do NOT add `Co-Authored-By` trailers for AI tools.

## Branch Protection

- `main` requires PR validation CI to pass before merge
- Direct pushes to `main` are blocked — all changes go through PRs
- The test pipeline is skipped for changes limited to `**/*.md`, `docs/**`, `features/**`, and `LICENSE`
