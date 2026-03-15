# Feature: `lspforge update` command

## Overview

Adds the ability to update installed LSP servers to their latest registry versions without manual uninstall/reinstall.

## Commands

```bash
lspforge update [server]     # Update specific or all servers
lspforge update --check      # Dry run: show available updates
lspforge update --force      # Reinstall even if version matches
```

## Implementation

### Version Comparison (`src/utils/version.ts`)
- Splits on `.`, `-`, `_` to handle semver and date tags
- Numeric segments compared numerically, others lexicographically
- Handles `v` prefix stripping

### Update Pipeline (`src/commands/update.ts`)
1. Load installed server state
2. Load registry package definition
3. Extract registry version from the matching source type
4. Compare versions — skip if up-to-date (unless `--force`)
5. Run installer in-place (overwrites existing install dir)
6. Health check after install
7. Update state.json with new version
8. Re-configure clients only if binPath changed

### Key Design Decisions
- **No uninstall/reinstall cycle**: overwrites in-place, preserving client configs
- **Source-aware version lookup**: checks the same source type the server was originally installed with
- **`--check` mode**: reports updates without modifying anything
- **`--force` mode**: useful for reinstalling after corruption or config changes
