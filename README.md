<div align="center">

```
  ██╗     ███████╗██████╗   ███████╗  ██████╗ ██████╗  ██████╗ ███████╗
  ██║     ██╔════╝██╔══██╗  ██╔════╝  ██╔═══╝ ██╔══██╗ ██╔════╝ ██╔════╝
  ██║     ███████╗██████╔╝  █████╗    ██║  ██╗██████╔╝ ██║  ███╗█████╗
  ██║     ╚════██║██╔═══╝   ██╔══╝    ██║  ██║██╔══██╗ ██║   ██║██╔══╝
  ███████╗███████║██║       ██║       ╚██████║██║  ██║ ╚██████╔╝███████╗
  ╚══════╝╚══════╝╚═╝       ╚═╝        ╚═════╝╚═╝  ╚═╝  ╚═════╝ ╚══════╝
```

**The missing package manager for LSP servers in AI coding tools.**

[![npm version](https://img.shields.io/npm/v/lspforge)](https://www.npmjs.com/package/lspforge)
[![license](https://img.shields.io/npm/l/lspforge)](https://github.com/svivekvarma/lspforge/blob/main/LICENSE)

</div>

---

## The Problem

AI coding tools need LSP servers for code intelligence — diagnostics, go-to-definition, find-references. But:

- **Servers are scattered** — npm, pip, cargo, go install, GitHub release binaries. Each has different steps on each OS.
- **Config is manual JSON editing** — Each tool stores LSP config differently. Copy-paste and pray.
- **Windows is broken** — `.cmd` wrapper spawning fails, file URIs are malformed, line endings crash servers.
- **Silent failures** — Servers fail to start with zero feedback.

## The Solution

One command. All your LSP servers. All your AI tools. All platforms.

```bash
npm install -g lspforge
```

## Quick Start

### Auto-detect everything

```bash
cd your-project
lspforge init
```

That's it. lspforge will:
1. **Scan** your project for languages (TypeScript? Python? Rust? Go?)
2. **Detect** which AI tools you have installed
3. **Install** the right LSP servers, sandboxed in `~/.lspforge/`
4. **Configure** each AI tool automatically
5. **Health check** every server with a real LSP handshake

### Install a specific server

```bash
lspforge install pyright
```

```
◐ Looking up pyright in registry...
◐ Installing pyright via npm...
✔ Installed pyright v1.1.408 via npm
◐ Running health check...
✔ Health check passed (230ms)
✔ Configured pyright in Claude Code (LSP plugin)
✔ Configured pyright in GitHub Copilot CLI (LSP)
✔ Configured pyright in OpenCode (LSP)
```

## Supported AI Tools

| Client | LSP Support | Config Written By lspforge | Post-Install Steps |
|--------|------------|----------------------------|--------------------|
| **Claude Code** | Native (plugin system) | `~/.claude/plugins/lspforge/.lsp.json` | Load plugin: `claude --plugin-dir ~/.claude/plugins/lspforge` |
| **GitHub Copilot CLI** | Native | `~/.copilot/lsp-config.json` | Restart Copilot CLI to pick up config |
| **OpenCode / Crush** | Native | `opencode.json` or `.crush.json` in project root | Restart OpenCode/Crush |

### Not supported (no LSP)

| Client | Reason | Status |
|--------|--------|--------|
| **Gemini CLI** | MCP only, no LSP | Watching — [LSP feature requested](https://github.com/google-gemini/gemini-cli/issues/2465) |
| **OpenAI Codex** | MCP only, no LSP | Watching — [LSP feature requested](https://github.com/openai/codex/issues/8745) |
| **Cline CLI** | MCP only, no LSP | Not planned |

> lspforge only integrates with tools that have **native LSP support**. We don't write LSP servers as MCP entries — they're different protocols.

## Available Servers

| Server | Languages | Install via |
|--------|-----------|-------------|
| `typescript-language-server` | TypeScript, JavaScript | npm |
| `pyright` | Python | npm / pip |
| `rust-analyzer` | Rust | Binary download |
| `gopls` | Go | go install |
| `eslint-lsp` | TypeScript, JavaScript | npm |

More coming soon! [Contribute a server definition →](./CONTRIBUTING.md)

## Commands

| Command | What it does |
|---------|-------------|
| `lspforge init` | Scan project, detect languages, install & configure everything |
| `lspforge install <server>` | Install a specific LSP server |
| `lspforge uninstall <server>` | Remove a server and clean up configs |
| `lspforge list` | Show installed servers (use `--available` to see registry) |
| `lspforge check` | Health check all servers (real LSP handshake) |
| `lspforge doctor` | Full environment diagnostics |

## How It Works

```
You run: lspforge install pyright

1. Registry lookup     → Find packages/pyright/package.yaml
2. Platform detect     → win32 x64, npm available
3. Source select       → npm defined + npm on PATH → use npm
4. Install             → npm install --prefix ~/.lspforge/servers/pyright
5. Verify binary       → Check pyright-langserver exists
6. Health check        → Send LSP initialize, expect capabilities back
7. Config generate     → Detect Claude Code → write .lsp.json plugin
8. State update        → Track in ~/.lspforge/state.json
```

All servers are **sandboxed** in `~/.lspforge/servers/` — no global pollution, no conflicts.

## Why lspforge?

### Windows-first

Most tools are built Linux/Mac-first. Windows users suffer the most:
- npm `.cmd` wrapper spawning fails → lspforge uses shell mode automatically
- File URIs malformed (`file://C:\` vs `file:///C:/`) → lspforge generates correct URIs
- Config lock files block onboarding → lspforge handles this gracefully

We built on Windows. We test on Windows. It works on Windows.

## Storage

```
~/.lspforge/                     # %LOCALAPPDATA%\lspforge on Windows
  state.json                     # Tracks installed servers
  servers/
    pyright/                     # Each server gets its own directory
      node_modules/.bin/pyright-langserver
    rust-analyzer/
      rust-analyzer
    gopls/
      bin/gopls
```

## Security

- **Version pinning** — Registry entries specify exact versions
- **Sandboxed installs** — Servers can't interfere with each other or your system
- **Managed config entries** — Tagged with `_managed_by: lspforge` so we never touch your manual config
- **No auto-install without confirmation** — `lspforge init` shows you what it'll do first

## Testing

```bash
# Unit tests (fast, no network)
npm test

# Full suite including E2E (installs real servers)
LSPFORGE_E2E=1 npm test
```

Tested across **3 operating systems** on every push via GitHub Actions.

## Deep Dive

| Document | What's inside |
|----------|--------------|
| [SOUL.md](./SOUL.md) | Vision, core principles, who this is for |
| [RESEARCH.md](./RESEARCH.md) | Market research, 30+ GitHub issues analyzed |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Technical design, install pipeline, registry schema |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | How to add servers, contribute code |

## Roadmap

- [x] Core CLI (init, install, uninstall, list, check, doctor)
- [x] npm, pip, cargo, go, binary installers
- [x] Claude Code, Copilot CLI, OpenCode/Crush clients
- [x] 5 bundled server definitions
- [x] Cross-platform CI (Linux, Windows, macOS)
- [x] LSP health checks
- [x] Windows-first platform handling
- [x] E2E test pipeline
- [ ] `lspforge search` command
- [ ] `lspforge update` command
- [ ] Gemini CLI support (when LSP ships)
- [ ] 20+ server definitions
- [ ] Separate registry repo (community-contributable)
- [ ] Declarative `lspconfig.yaml` for team sharing

## Feedback

Found a bug? Have a feature request? Want to add a server?

- [Open an issue](https://github.com/svivekvarma/lspforge/issues)
- [Read the contributing guide](./CONTRIBUTING.md)

## License

MIT
