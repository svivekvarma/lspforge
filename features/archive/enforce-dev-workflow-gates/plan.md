# Enforce Dev Workflow Gates

**Issue**: https://github.com/svivekvarma/lspforge/issues/1
**Branch**: `chore/enforce-dev-workflow-gates`

## Problem

Development workflow rules existed only in contributor memory. No CI or project-level enforcement.

## Changes

1. **CLAUDE.md** — Added Development Workflow, Commit Conventions, and Branch Protection sections
2. **ci.yml** — Added `paths-ignore` for `*.md`, `docs/**`, `features/**`, `LICENSE`
3. **pr.yml** — Same `paths-ignore` filtering
4. **features/** — Created directory structure with `archive/` subfolder

## Manual Setup Required

- GitHub branch protection on `main`: require 1 approving review from `svivekvarma`
- GitHub branch protection: require PR validation CI to pass before merge
