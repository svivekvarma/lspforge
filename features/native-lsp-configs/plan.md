# Native LSP Configs

**Issue**: https://github.com/svivekvarma/lspforge/issues/4
**Branch**: `feat/native-lsp-configs`

## Problem

Client adapters were injecting LSP servers as MCP servers, but Claude Code and Copilot CLI have native LSP support with dedicated config formats.

## Changes

### Client adapters
- **claude-code.ts** — Rewritten to generate `.lsp.json` plugin at `~/.claude/plugins/lspforge/`
- **copilot-cli.ts** — Rewritten to write `~/.copilot/lsp-config.json` with `lspServers` format
- **codex.ts** — Kept as MCP (Codex has no LSP support)

### Registry schema
- Added `extension_to_language` field to all 5 package.yaml definitions
- Updated `PackageLsp` TypeScript interface
- Extended `ClientConfig` interface with `extensionToLanguage`

### Documentation
- **ARCHITECTURE.md** — Updated target clients table, source structure, install pipeline, config ownership
- **SOUL.md** — Clarified native LSP vs MCP fallback strategy
- **RESEARCH.md** — Added Copilot CLI native LSP and Codex no-LSP findings
- **CLAUDE.md** — Updated MVP client descriptions

## Config Formats Generated

### Claude Code (.lsp.json)
```json
{
  "pyright": {
    "command": "/path/to/pyright-langserver",
    "args": ["--stdio"],
    "extensionToLanguage": { ".py": "python", ".pyi": "python" }
  }
}
```

### Copilot CLI (lsp-config.json)
```json
{
  "lspServers": {
    "pyright": {
      "_managed_by": "lspforge",
      "command": "/path/to/pyright-langserver",
      "args": ["--stdio"],
      "fileExtensions": { ".py": "python", ".pyi": "python" }
    }
  }
}
```

### Codex (config.toml — MCP fallback)
```toml
[mcp_servers.pyright]
_managed_by = "lspforge"
command = "/path/to/pyright-langserver"
args = ["--stdio"]
```
