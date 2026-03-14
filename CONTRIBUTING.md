# 🤝 Contributing to lspforge

Thanks for wanting to help! lspforge is in its early days, and contributions of all kinds are welcome — from adding new server definitions to fixing bugs to improving docs.

## 📦 Adding a New Server Definition

This is the **highest-impact** contribution you can make. Each server definition lives in `registry/packages/<name>/package.yaml`.

### Step-by-step

1. **Fork & clone** the repo
2. **Create a directory** for your server:
   ```
   registry/packages/<server-name>/package.yaml
   ```
3. **Write the definition** using this template:

```yaml
name: my-language-server
description: Short description of what this server does
languages:
  - language-name    # lowercase (python, rust, go, typescript, etc.)

source:
  # Pick ONE or more install methods:

  # npm-based server
  npm:
    package: package-name-on-npm
    bin: binary-name          # What gets put in node_modules/.bin/
    version: "1.2.3"          # Pin to a specific version

  # pip-based server
  pip:
    package: package-name-on-pypi
    bin: binary-name
    version: "1.2.3"

  # Cargo-based server
  cargo:
    package: crate-name
    bin: binary-name
    version: "1.2.3"

  # Go-based server
  go:
    package: golang.org/x/tools/gopls    # Full Go module path
    bin: binary-name
    version: "v1.2.3"

  # GitHub release binary
  github_release:
    repo: owner/repo
    tag: "v1.2.3"
    assets:
      linux_x64: filename-linux-amd64.tar.gz
      linux_arm64: filename-linux-arm64.tar.gz
      darwin_x64: filename-darwin-amd64.tar.gz
      darwin_arm64: filename-darwin-arm64.tar.gz
      win_x64: filename-windows-amd64.zip
    bin: binary-name
    extract: gzip    # gzip, zip, tar.gz, or none

lsp:
  command: binary-name       # Command to start the server
  args: ["--stdio"]          # Arguments (most servers use --stdio)
  file_patterns:             # Glob patterns for files this server handles
    - "**/*.ext"

# Optional: platform-specific settings
platforms:
  win32:
    spawn_shell: true        # Needed for npm .cmd wrappers on Windows

health:
  timeout_ms: 10000          # How long to wait for LSP initialize response
```

4. **Test it locally**:
   ```bash
   npm run build
   node dist/cli.js install my-language-server --skip-config
   node dist/cli.js check my-language-server
   ```

5. **Submit a PR** with:
   - The `package.yaml` file
   - Which platforms you tested on
   - The output of `lspforge check` showing it passes

### Tips for good server definitions

- **Always pin versions** — Don't leave version blank unless there's a good reason
- **Test on Windows** if you can — that's where most issues hide
- **Set `spawn_shell: true`** for npm-based servers on the `win32` platform
- **Include all platform assets** for binary downloads — check the release page for available binaries
- **Set an appropriate health timeout** — some servers (like rust-analyzer, jdtls) take longer to initialize

### Servers we'd love to have

Here are some high-value servers not yet in the registry:

| Server | Language | Install method | Difficulty |
|--------|----------|---------------|------------|
| `clangd` | C/C++ | Binary download | Medium |
| `jdtls` | Java | Binary download | Hard (needs JDK) |
| `omnisharp` | C# | Binary download | Medium |
| `solargraph` | Ruby | gem | Medium |
| `intelephense` | PHP | npm | Easy |
| `kotlin-language-server` | Kotlin | Binary download | Medium |
| `lua-language-server` | Lua | Binary download | Medium |
| `elixir-ls` | Elixir | Binary download | Medium |
| `zls` | Zig | Binary download | Easy |
| `ruff` | Python (linter) | pip | Easy |

## 🐛 Reporting Bugs

When filing an issue, please include:

1. **Output of `lspforge doctor`** — this tells us your platform, runtimes, and tool versions
2. **What you ran** — the exact command
3. **What happened** — the full output (including errors)
4. **What you expected** — what should have happened

## 💻 Contributing Code

### Setup

```bash
git clone https://github.com/svivekvarma/lspforge.git
cd lspforge
npm install
npm run build
npm test
```

### Project Structure

```
src/
  cli.ts                    # Entry point — citty CLI app
  commands/                 # One file per CLI command (init, install, etc.)
  core/                     # Registry loading, platform detection, state management
  installers/               # One file per install method (npm, pip, cargo, go, binary)
  clients/                  # One file per AI tool (claude-code, copilot-cli, codex)
  health/                   # LSP initialize handshake for health checks
  detect/                   # Project language detection
  utils/                    # Cross-platform spawn, file URIs, JSON merging, downloads
  __tests__/                # Test files (vitest)
registry/
  packages/                 # Server definitions (YAML)
```

For a deeper understanding, read:
- [ARCHITECTURE.md](./ARCHITECTURE.md) — Full technical design
- [SOUL.md](./SOUL.md) — Vision and principles

### Key Files

If you're fixing a bug, these are the files that matter most:

| File | Why it matters |
|------|---------------|
| `src/utils/spawn.ts` | Cross-platform process spawning — most Windows bugs live here |
| `src/core/registry.ts` | Registry loading and path resolution |
| `src/installers/npm.ts` | The most common installer — pattern for all others |
| `src/clients/claude-code.ts` | Claude Code config — template for new client integrations |
| `src/health/lsp-check.ts` | LSP handshake — JSON-RPC framing must be exact |

### Adding a New Client

Want to add support for a new AI tool (e.g., Gemini CLI, VS Code Copilot)?

1. Create `src/clients/<tool-name>.ts` following the pattern in `claude-code.ts` or `copilot-cli.ts`
2. Implement `configure()` and `unconfigure()` functions
3. Add detection logic in `src/clients/index.ts`
4. Add a test
5. Submit a PR

### Commands

```bash
npm run build        # Build with tsup
npm run dev          # Build in watch mode
npm test             # Run tests (vitest)
npm run typecheck    # Type check without emitting
```

### Code Style

- TypeScript strict mode
- ESM modules
- Minimal dependencies
- Handle Windows edge cases explicitly (don't assume Unix)
- Fail loudly — never silently swallow errors
- Tag managed config entries with `_managed_by: lspforge`

### Tests

Every PR should include tests. We use [vitest](https://vitest.dev/). Tests live in `src/__tests__/`.

Run tests:
```bash
npm test              # Run all tests
npx vitest run        # Run once (CI mode)
npx vitest --watch    # Watch mode
```

## 🗺️ Areas That Need Help

- **More server definitions** — the registry is the product
- **Phase 2 clients** — Gemini CLI (`~/.gemini/settings.json`), VS Code Copilot (`.vscode/mcp.json`), Claude Desktop
- **`lspforge update` command** — update installed servers to latest versions
- **`lspforge search` command** — search the registry
- **CI/CD** — GitHub Actions for testing across platforms
- **Better health check diagnostics** — parse LSP error responses, suggest fixes

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.
