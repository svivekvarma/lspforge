# Run full test suite on Windows natively.
# Usage: .\scripts\test-windows.ps1
# Tip: Run inside Windows Sandbox for a clean environment.

$ErrorActionPreference = "Stop"

Write-Host "🪟 Testing lspforge on Windows" -ForegroundColor Cyan
Write-Host ""

Write-Host "=== Environment ===" -ForegroundColor Yellow
node --version
npm --version
Write-Host ""

Write-Host "=== Install dependencies ===" -ForegroundColor Yellow
npm ci
Write-Host ""

Write-Host "=== Build ===" -ForegroundColor Yellow
npm run build
Write-Host ""

Write-Host "=== Tests ===" -ForegroundColor Yellow
npx vitest run
Write-Host ""

Write-Host "=== CLI Smoke Tests ===" -ForegroundColor Yellow
node dist/cli.js --help
node dist/cli.js doctor
node dist/cli.js list --available
node dist/cli.js install pyright --skip-config
node dist/cli.js check pyright
node dist/cli.js list
node dist/cli.js uninstall pyright
Write-Host ""

Write-Host "✅ All tests passed on Windows!" -ForegroundColor Green
