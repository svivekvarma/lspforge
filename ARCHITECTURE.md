# Architecture — lspforge

## Overview

`lspforge` is an npm CLI that installs, manages, and configures LSP servers for AI coding tools. Think mason.nvim but for Claude Code, Copilot CLI, Codex, Gemini CLI, and VS Code Copilot.

## Target Clients

### MVP (Phase 1)
| Client | Config File | Format |
|--------|------------|--------|
| Claude Code | `claude mcp add` CLI | JSON (`mcpServers`) |
| GitHub Copilot CLI | `~/.copilot/mcp-config.json` | JSON (`mcpServers`) |
| OpenAI Codex | `~/.codex/config.toml` | TOML (`[mcp_servers.<name>]`) |

### Phase 2
| Client | Config File | Format |
|--------|------------|--------|
| Gemini CLI | `~/.gemini/settings.json` | JSON (`mcpServers`) |
| VS Code Copilot | `.vscode/mcp.json` | JSON (`servers`) |
| Claude Desktop | `claude_desktop_config.json` | JSON (`mcpServers`) |

## CLI Commands

```
lspforge init                       # Detect languages + tools → install + configure
lspforge install <server>[@ver]     # Install one server
lspforge uninstall <server>         # Remove server + clean config entries
lspforge list                       # Show installed servers
lspforge check [server]             # Health check (LSP initialize handshake)
lspforge doctor                     # Full diagnostics (platform, runtimes, servers)
```

## Source Structure

```
src/
  cli.ts                    # Entry point — citty app with subcommands
  commands/                 # One file per CLI command
  core/
    registry.ts             # Load bundled registry YAML, lookup servers
    platform.ts             # OS/arch detection, platform key mapping
    paths.ts                # Data dirs (~/.lspforge/, %LOCALAPPDATA%\lspforge)
    state.ts                # state.json — tracks installed servers
  installers/
    index.ts                # Installer interface + factory (pick by source type)
    npm.ts                  # npm install --prefix (Windows .cmd handling)
    pip.ts                  # Create venv + pip install
    cargo.ts                # cargo install --root
    go.ts                   # GOBIN= go install
    binary.ts               # GitHub release download + extract + chmod
  clients/
    index.ts                # Client interface + auto-detection
    claude-code.ts          # Shells out to `claude mcp add`
    copilot-cli.ts          # Deep-merges ~/.copilot/mcp-config.json
    codex.ts                # Appends to ~/.codex/config.toml
  health/
    lsp-check.ts            # Spawn server, send LSP initialize, validate response
  detect/
    languages.ts            # Scan project root for language indicators
  utils/
    spawn.ts                # Cross-platform child_process.spawn wrapper
    file-uri.ts             # Correct file:// URI per OS
    json-merge.ts           # Deep merge JSON configs, preserve user entries
    download.ts             # HTTP download with checksum verification
```

## Install Pipeline

```
User runs: lspforge install pyright

1. Registry lookup     → Find packages/pyright/package.yaml
2. Platform detect     → win32 x64, npm available
3. Source select       → source.npm defined + npm on PATH → use npm
4. Install             → npm install --prefix ~/.lspforge/servers/pyright pyright@1.1.408
5. Verify binary       → Check node_modules/.bin/pyright-langserver exists
6. Health check        → Spawn server, send LSP initialize, expect capabilities
7. Config generate     → Detect Claude Code installed → claude mcp add ...
8. State update        → Write to ~/.lspforge/state.json
```

## Registry Schema

Each server defined in `registry/packages/<name>/package.yaml`:

```yaml
name: pyright
description: Static type checker for Python
languages: [python]

source:
  npm:
    package: pyright
    bin: pyright-langserver

  # Alternative sources (installer picks first available)
  # pip:
  #   package: pyright
  #   bin: pyright-langserver

lsp:
  command: pyright-langserver
  args: ["--stdio"]
  file_patterns: ["**/*.py", "**/*.pyi"]

platforms:
  win32:
    spawn_shell: true    # Use shell:true for .cmd wrappers

health:
  timeout_ms: 10000
```

For binary-download servers (e.g., rust-analyzer):

```yaml
name: rust-analyzer
description: LSP for Rust
languages: [rust]

source:
  github_release:
    repo: rust-lang/rust-analyzer
    tag: "2026-03-09"
    assets:
      linux_x64: rust-analyzer-x86_64-unknown-linux-gnu.gz
      linux_arm64: rust-analyzer-aarch64-unknown-linux-gnu.gz
      darwin_x64: rust-analyzer-x86_64-apple-darwin.gz
      darwin_arm64: rust-analyzer-aarch64-apple-darwin.gz
      win_x64: rust-analyzer-x86_64-pc-windows-msvc.zip
    bin: rust-analyzer      # rust-analyzer.exe on Windows (auto-suffixed)
    extract: gzip           # or "zip" for Windows

lsp:
  command: rust-analyzer
  args: []
  file_patterns: ["**/*.rs", "**/Cargo.toml"]

health:
  timeout_ms: 15000
```

## Storage Layout

```
~/.lspforge/                          # %LOCALAPPDATA%\lspforge on Windows
  state.json                          # { servers: { pyright: { version, path, ... } } }
  servers/
    pyright/
      node_modules/.bin/pyright-langserver
    rust-analyzer/
      rust-analyzer (binary)
    gopls/
      bin/gopls
    ruff/
      venv/bin/ruff
```

## Platform Handling

### Windows (first-class support)
- **`.cmd` wrappers**: npm installs `.cmd` shims on Windows. `spawn.ts` detects these and uses `shell: true`.
- **File URIs**: `file:///C:/path` (three slashes, forward slashes). Never `file://C:\path`.
- **Line endings**: LSP JSON-RPC headers use `\r\n`. Always.
- **Data dir**: `%LOCALAPPDATA%\lspforge`, not `~/.lspforge`.

### macOS
- Data dir: `~/.lspforge`

### Linux
- Data dir: `$XDG_DATA_HOME/lspforge` or `~/.local/share/lspforge`

## Language Detection

Scan project root for indicator files:

| File | Language | Confidence |
|------|----------|------------|
| `tsconfig.json` | TypeScript | certain |
| `package.json` | TypeScript/JavaScript | high |
| `Cargo.toml` | Rust | certain |
| `go.mod` | Go | certain |
| `pyproject.toml` | Python | high |
| `requirements.txt` | Python | high |
| `*.csproj` / `*.sln` | C# | certain |
| `Gemfile` | Ruby | certain |
| `pom.xml` | Java | certain |
| `composer.json` | PHP | certain |

## Health Check

Spawns the server process, sends a proper LSP `initialize` request via JSON-RPC over stdio, and validates the response contains `capabilities`. Includes proper `shutdown` + `exit` sequence. Timeout configurable per server (default 10s).

## Tech Stack

| Concern | Choice | Why |
|---------|--------|-----|
| CLI framework | citty | Lightweight, TS-first, zero deps |
| Registry format | YAML (js-yaml) | Human-readable, comments, mason convention |
| Build | tsup | Fast esbuild-based, single output |
| Test | vitest | ESM native, fast |
| Logging | consola | Colors, levels, structured |
| HTTP | ofetch | Downloads, retries |
| TOML | smol-toml | For Codex config.toml |

## Config Ownership

Managed entries are tagged so `lspforge uninstall` can remove them cleanly:
- **JSON configs**: `"_managed_by": "lspforge"` field on each server entry
- **TOML configs**: `# managed by lspforge` comment above each section
- **Claude Code**: Uses `claude mcp remove` CLI command

Deep-merge strategy: read existing config, only touch entries we manage, preserve everything else, match existing indentation.

## Testing Strategy

### Layers

1. **Unit tests** (vitest) — Pure logic: platform detection, registry parsing, JSON merging, installer selection, file URI generation. Fast, no I/O.
2. **CLI smoke tests** (CI + local) — Real end-to-end: install pyright via npm, run LSP health check, verify state, uninstall. Catches platform-specific issues.
3. **Cross-platform matrix** (GitHub Actions) — 3 OSes × 2 Node versions = 6 environments on every push.

### CI Matrix

| | Ubuntu | Windows | macOS |
|---|---|---|---|
| **Node 20** | ✅ | ✅ | ✅ |
| **Node 22** | ✅ | ✅ | ✅ |

### Local Testing

| Platform | Method | Command |
|----------|--------|---------|
| Linux | Docker container (node:22-slim) | `docker build -f Dockerfile.test .` or `./scripts/test-linux.sh` |
| Windows | Native (optionally in Windows Sandbox) | `.\scripts\test-windows.ps1` |
| macOS | GitHub Actions only (requires Apple hardware) | Automatic on push |

### What Smoke Tests Catch That Unit Tests Don't

- Windows `.cmd` shim spawning via `shell: true`
- File URI format differences (`file:///C:/` vs `file://`)
- LSP JSON-RPC `\r\n` header line endings
- npm `--prefix` sandboxing behavior per platform
- Binary permissions (`chmod +x`) on Unix
- Path separator handling in state.json
