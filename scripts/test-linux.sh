#!/usr/bin/env bash
# Run full test suite in a Linux Docker container.
# Usage: ./scripts/test-linux.sh [ubuntu|alpine|debian]

set -euo pipefail

DISTRO="${1:-ubuntu}"

case "$DISTRO" in
  ubuntu)
    BASE_IMAGE="node:22-bookworm-slim"
    ;;
  alpine)
    BASE_IMAGE="node:22-alpine"
    ;;
  debian)
    BASE_IMAGE="node:22-bookworm-slim"
    ;;
  *)
    echo "Usage: $0 [ubuntu|alpine|debian]"
    exit 1
    ;;
esac

echo "🐧 Testing lspforge on Linux ($DISTRO) using $BASE_IMAGE"
echo ""

docker run --rm -v "$(pwd):/app" -w /app "$BASE_IMAGE" sh -c '
  echo "=== Environment ==="
  node --version
  npm --version
  uname -a
  echo ""

  echo "=== Install dependencies ==="
  npm ci --ignore-scripts
  echo ""

  echo "=== Build ==="
  npm run build
  echo ""

  echo "=== Tests ==="
  npx vitest run
  echo ""

  echo "=== CLI Smoke Tests ==="
  node dist/cli.js --help
  node dist/cli.js doctor
  node dist/cli.js list --available
  node dist/cli.js install pyright --skip-config
  node dist/cli.js check pyright
  node dist/cli.js list
  node dist/cli.js uninstall pyright
  echo ""

  echo "✅ All tests passed on Linux ($DISTRO)!"
'
