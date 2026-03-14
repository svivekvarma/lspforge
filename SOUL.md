# lspforge — Soul Document

## What Is This?

A **mason.nvim-style package manager for AI coding tools** — a CLI that installs, manages, and configures LSP and MCP servers across Claude Code, GitHub Copilot CLI, Cursor, Windsurf, and VS Code.

## The Problem

AI coding tools (Claude Code, Copilot CLI, Cursor, Windsurf) need LSP and MCP servers to provide code intelligence — go-to-definition, find-references, diagnostics, hover info. But installing these servers is a fragmented, error-prone, platform-specific nightmare:

1. **LSP servers are scattered** — `typescript-language-server` is on npm, `pyright` on pip/npm, `rust-analyzer` is a GitHub release binary, `gopls` needs `go install`. Each has different install steps on each OS.
2. **Config is manual JSON editing** — Each AI tool stores LSP config differently (Claude Code uses `.lsp.json` plugins, Copilot CLI uses `~/.copilot/lsp-config.json`, others use MCP). Users copy-paste JSON snippets and pray.
3. **Windows is broken** — `child_process.spawn()` can't execute npm `.cmd` wrappers (ENOENT), file URIs are malformed (`file://C:\` vs `file:///C:/`), line endings crash strict JSON-RPC servers, lock files block onboarding.
4. **Silent failures** — Servers fail to start with zero feedback. Config settings are silently ignored. Results are silently dropped.
5. **No unified tool owns this** — Smithery is a web marketplace for MCP discovery. mcpman is new and focused on MCP config. copilot-mcp is a VS Code extension. cclsp bridges LSP↔MCP but doesn't install servers. Nobody handles the full pipeline: detect OS → install binary → wire config → health check.

## The Gap (Why Existing Tools Don't Solve This)

| Tool | What it does | What it doesn't do |
|------|-------------|-------------------|
| **Smithery** (7,300+ tools) | Web marketplace for MCP server discovery | Doesn't install LSP servers, doesn't handle platform quirks |
| **mcpman** | CLI for MCP server config across clients | Doesn't install LSP binaries, very new |
| **copilot-mcp** | VS Code extension for MCP discovery | VS Code only, doesn't install binaries |
| **cclsp** | Bridges LSP↔MCP for Claude Code | Doesn't install LSP servers, user must install them manually |
| **Piebald-AI/claude-code-lsps** | Plugin marketplace for Claude Code | Claude Code only, doesn't install server binaries |
| **install-mcp** | CLI for MCP installation | MCP only, no LSP |
| **mason.nvim** | The gold standard — installs 400+ servers | Neovim only, not usable outside Neovim |

**The gap**: No tool does what mason.nvim does (install the actual server binary, handle platform differences, sandbox the install) but for AI coding tools instead of Neovim.

## The Solution

An npm package (CLI tool) that:

1. **Detects your environment** — Which AI tools are installed? What OS/platform? What languages does your project use?
2. **Installs LSP server binaries** — Downloads/installs the right server for each language using the right package manager (npm, pip, cargo, go, binary download), sandboxed to avoid system pollution.
3. **Generates config** — Writes the correct native LSP config for each detected AI tool (Claude Code `.lsp.json` plugin, Copilot CLI `lsp-config.json`), falling back to MCP config for tools without LSP support (Codex, Gemini CLI).
4. **Handles platform quirks** — Windows `.cmd` wrapper workarounds, correct file URI formats, proper line endings.
5. **Health checks** — Verifies servers start, respond to `initialize`, and are actually functional.
6. **Declarative config** — A single `lspconfig.yaml` (or similar) where users list desired servers; the tool ensures they're installed and configured.

## Core Principles

1. **Zero-config by default** — Scan the project, detect languages, install the right servers. Power users can customize via config file.
2. **Cross-platform first** — Windows must work as well as macOS/Linux. This is where the most pain exists.
3. **Cross-client** — One tool configures all AI coding clients. Don't make users learn per-tool setup.
4. **Sandboxed installs** — Never pollute the global system. All servers installed in a managed directory.
5. **Fail loudly** — Never silently ignore errors. Clear diagnostics when something doesn't work.
6. **Offline-capable** — Once installed, servers should work without internet. Cache binaries.
7. **Security-conscious** — Version pinning by default. Checksum verification. No auto-install without confirmation.

## Who Is This For?

- **Developers using AI coding tools** who want LSP-powered code intelligence but don't want to spend 30 minutes per language figuring out server installation.
- **Teams** who want a reproducible dev setup — commit a config file, teammates run one command.
- **Windows users** who are disproportionately affected by platform bugs in AI tool LSP/MCP integrations.
- **Newcomers to AI coding tools** who are blocked at the "install an MCP/LSP server" step.

## What This Is NOT

- Not another MCP server registry/marketplace (Smithery does that)
- Not an MCP server framework/SDK (Anthropic provides that)
- Not a VS Code extension (copilot-mcp does that)
- Not an LSP client or protocol implementation

## Competitive Moat

1. **Registry quality** — Curated, tested installation metadata per server per platform (like mason-registry)
2. **Platform compatibility** — Deep handling of Windows quirks that nobody else bothers with
3. **Cross-client config generation** — One source of truth for all your AI tools
4. **Health diagnostics** — Not just "install and hope" but "install, verify, and report"

## Success Metrics

- A developer can go from zero to working LSP servers across all their AI tools in < 2 minutes
- Windows setup works as reliably as macOS/Linux
- Community contributes server definitions (registry grows like mason-registry)

## Name

**lspforge** — forging connections between LSP servers and AI coding tools.

npm package: `lspforge`
CLI binary: `lspforge`
