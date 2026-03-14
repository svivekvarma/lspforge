# 🔥 lspforge

**The missing package manager for LSP servers in AI coding tools.**

> Think [mason.nvim](https://github.com/williamboman/mason.nvim) — but for Claude Code, GitHub Copilot CLI, and OpenAI Codex.

[![npm version](https://img.shields.io/npm/v/lspforge)](https://www.npmjs.com/package/lspforge)
[![license](https://img.shields.io/npm/l/lspforge)](https://github.com/svivekvarma/lspforge/blob/main/LICENSE)

---

## 😤 The Problem

You're using AI coding tools. You want LSP-powered code intelligence — go-to-definition, find-references, diagnostics. But installing LSP servers is a nightmare:

- **Servers are everywhere** — `typescript-language-server` is on npm, `pyright` on pip, `rust-analyzer` is a GitHub release binary, `gopls` needs `go install`. Each has different steps on each OS.
- **Config is manual JSON editing** — Claude Code uses `.mcp.json`, Copilot CLI uses `~/.copilot/mcp-config.json`, Codex uses `~/.codex/config.toml`. Copy-paste JSON and pray.
- **Windows is broken** — `.cmd` wrapper spawning fails, file URIs are malformed, line endings crash servers. [Dozens of open issues](./RESEARCH.md).
- **Silent failures** — Servers fail to start with zero feedback. You have no idea what went wrong.

## 🛠️ The Solution

One command. All your LSP servers. All your AI tools. All platforms.

```bash
npm install -g lspforge
```

## 🚀 Quick Start

### Auto-detect everything

```bash
cd your-project
lspforge init
```

That's it. lspforge will:
1. 🔍 **Scan** your project for languages (TypeScript? Python? Rust? Go?)
2. 🔎 **Detect** which AI tools you have installed
3. 📦 **Install** the right LSP servers, sandboxed in `~/.lspforge/`
4. ⚙️ **Configure** each AI tool automatically
5. ✅ **Health check** every server with a real LSP handshake

### Install a specific server

```bash
lspforge install pyright
```

```
◐ Looking up pyright in registry...
◐ Installing pyright via npm...
✔ Installed pyright v1.1.408 via npm
◐ Running health check...
✔ Health check passed (385ms)
✔ Configured pyright in Claude Code
✔ Configured pyright in GitHub Copilot CLI
✔ Configured pyright in Codex
```

### Check your environment

```bash
lspforge doctor
```

```
ℹ Platform
  OS:           win32 x64
  Node.js:      v22.3.0

ℹ Runtimes
  npm            11.10.1
  python         Python 3.12.4
  pip            pip 24.0
  cargo          v1.79.0
  go             v1.22.5

ℹ AI Coding Tools
  Claude Code            installed
  GitHub Copilot CLI     installed
  Codex                  installed

ℹ Installed Servers: 3
  Healthy:      3
```

## 📋 Commands

| Command | What it does |
|---------|-------------|
| `lspforge init` | 🔍 Scan project, detect languages, install & configure everything |
| `lspforge install <server>` | 📦 Install a specific LSP server |
| `lspforge uninstall <server>` | 🗑️ Remove a server and clean up configs |
| `lspforge list` | 📃 Show installed servers (use `--available` to see registry) |
| `lspforge check` | 🏥 Health check all servers (real LSP handshake) |
| `lspforge doctor` | 🩺 Full environment diagnostics |

## 📦 Available Servers

| Server | Languages | Install via |
|--------|-----------|-------------|
| `typescript-language-server` | TypeScript, JavaScript | npm |
| `pyright` | Python | npm / pip |
| `rust-analyzer` | Rust | Binary download |
| `gopls` | Go | go install |
| `eslint-lsp` | TypeScript, JavaScript | npm |

More coming soon! [Contribute a server definition →](./CONTRIBUTING.md)

## 🤖 Supported AI Tools

### MVP (now)
| Tool | Config location | How lspforge configures it |
|------|----------------|---------------------------|
| **Claude Code** | `claude mcp add` | Shells out to CLI (safest) |
| **GitHub Copilot CLI** | `~/.copilot/mcp-config.json` | Deep-merges JSON |
| **OpenAI Codex** | `~/.codex/config.toml` | Appends TOML section |

### Coming Soon
| Tool | Status |
|------|--------|
| Gemini CLI | 🔜 Phase 2 |
| VS Code Copilot | 🔜 Phase 2 |
| Claude Desktop | 🔜 Phase 2 |

## 🧠 Why lspforge?

### The mason.nvim parallel

Neovim had the exact same problem. LSP servers were painful to install — scattered across package managers, each needing different steps per OS. Then [mason.nvim](https://github.com/williamboman/mason.nvim) came along with a curated registry, sandboxed installs, and declarative config. It has 8,000+ stars and transformed the Neovim experience.

**AI coding tools are at the same stage Neovim was pre-mason.** lspforge brings the same solution to the AI tools ecosystem.

### What makes lspforge different?

We researched [every existing tool](./RESEARCH.md) in this space. Here's why none of them solve the full problem:

| Tool | What it does | What it doesn't do |
|------|-------------|-------------------|
| **Smithery** | Web marketplace for MCP discovery | Doesn't install LSP binaries |
| **mcpman** | CLI for MCP config management | Doesn't install LSP binaries |
| **cclsp** | Bridges LSP↔MCP | Doesn't install servers — you do that manually |
| **copilot-mcp** | VS Code extension | VS Code only |
| **mason.nvim** | The gold standard | Neovim only |

**lspforge fills the gap**: install the actual binary + handle platform quirks + wire configs across all AI tools.

### 🪟 Windows-first

Most tools are built Linux/Mac-first. Windows users suffer the most:
- npm `.cmd` wrapper spawning fails → lspforge uses shell mode automatically
- File URIs malformed (`file://C:\` vs `file:///C:/`) → lspforge generates correct URIs
- Config lock files block onboarding → lspforge handles this gracefully

We built on Windows. We test on Windows. It works on Windows.

## 🏗️ How It Works

```
You run: lspforge install pyright

1. Registry lookup     → Find packages/pyright/package.yaml
2. Platform detect     → win32 x64, npm available
3. Source select       → npm defined + npm on PATH → use npm
4. Install             → npm install --prefix ~/.lspforge/servers/pyright
5. Verify binary       → Check pyright-langserver exists
6. Health check        → Send LSP initialize, expect capabilities back
7. Config generate     → Detect Claude Code → claude mcp add
8. State update        → Track in ~/.lspforge/state.json
```

All servers are **sandboxed** in `~/.lspforge/servers/` — no global pollution, no conflicts.

## 📁 Storage

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

## 🔐 Security

We take supply chain security seriously:
- **Version pinning** — Registry entries specify exact versions
- **Sandboxed installs** — Servers can't interfere with each other or your system
- **Managed config entries** — Tagged with `_managed_by: lspforge` so we never touch your manual config
- **No auto-install without confirmation** — `lspforge init` shows you what it'll do first

## 🧪 Testing

lspforge is tested across **3 operating systems** and **2 Node.js versions** on every push.

### CI Matrix (GitHub Actions)

| | Ubuntu | Windows | macOS |
|---|---|---|---|
| **Node 20** | ✅ | ✅ | ✅ |
| **Node 22** | ✅ | ✅ | ✅ |

Each CI job runs: typecheck → build → 40 unit tests → 7 CLI smoke tests (including a real `pyright` install + LSP health check).

### Local Testing

```bash
# Run unit tests
npm test

# Test on Linux via Docker
docker build -f Dockerfile.test .
# or
./scripts/test-linux.sh ubuntu

# Test on Windows natively (use Windows Sandbox for a clean env)
.\scripts\test-windows.ps1
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for more details on the test setup.

## 📖 Deep Dive

Want to understand the thinking behind lspforge?

| Document | What's inside |
|----------|--------------|
| [🔮 SOUL.md](./SOUL.md) | Vision, core principles, who this is for, what this is NOT |
| [📊 RESEARCH.md](./RESEARCH.md) | Market research, 30+ GitHub issues analyzed, competitive landscape |
| [🏛️ ARCHITECTURE.md](./ARCHITECTURE.md) | Technical design, install pipeline, registry schema, platform handling |
| [🤝 CONTRIBUTING.md](./CONTRIBUTING.md) | How to add servers, contribute code, or report issues |

## 🗺️ Roadmap

- [x] Core CLI (init, install, uninstall, list, check, doctor)
- [x] npm, pip, cargo, go, binary installers
- [x] Claude Code, Copilot CLI, Codex clients
- [x] 5 bundled server definitions
- [x] Cross-platform CI (Linux, Windows, macOS × Node 20, 22)
- [x] LSP health checks
- [x] Windows-first platform handling
- [ ] `lspforge search` command
- [ ] `lspforge update` command
- [ ] Gemini CLI, VS Code Copilot, Claude Desktop clients
- [ ] 20+ server definitions
- [ ] Separate registry repo (community-contributable)
- [ ] Declarative `lspconfig.yaml` for team sharing
- [x] CI/CD: PR validation, release pipeline, npm auto-publish

## 🚢 Releasing

Releases are fully automated via GitHub Actions:

```bash
# 1. Bump version in package.json
npm version patch   # or minor / major

# 2. Push the tag
git push --follow-tags
```

This triggers the release pipeline:
1. ✅ Full cross-platform validation (3 OSes × 2 Node versions)
2. 📦 Publish to npm (version verified against tag)
3. 🏷️ Create GitHub Release with auto-generated changelog

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## 💬 Feedback

Found a bug? Have a feature request? Want to add a server?

- 🐛 [Open an issue](https://github.com/svivekvarma/lspforge/issues)
- 🤝 [Read the contributing guide](./CONTRIBUTING.md)
- ⭐ Star the repo if lspforge saved you time!

## 📄 License

MIT
