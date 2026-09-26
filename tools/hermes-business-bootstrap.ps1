# Hermes Business Bootstrap — safe/minimal
# Purpose:
#   1) create a backup of the current Hermes home
#   2) install the two audited business skills from the canonical BCO repo
#   3) verify the installed skills
#
# Intentionally does NOT:
#   - update Hermes
#   - change the active model/provider
#   - add MCP servers
#   - add/remove cron jobs
#   - send messages
#   - change credentials
#   - start/stop gateway
#
# This keeps the current working setup intact until the next audit stage.

$ErrorActionPreference = 'Stop'
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"

if (-not (Get-Command hermes -ErrorAction SilentlyContinue)) {
  throw "'hermes' is not on PATH in this PowerShell session."
}

Write-Host "=== HERMES BUSINESS BOOTSTRAP ==="
Write-Host "Hermes: $(hermes --version | Select-Object -First 1)"
Write-Host ""

Write-Host "[1/3] Creating Hermes backup..."
hermes backup
Write-Host ""

Write-Host "[2/3] Installing BCO operator skill..."
hermes skills install "https://raw.githubusercontent.com/lickovci-cpu/Business-Control-ONE-17-MAX-/main/hermes-skills/bco-operator/SKILL.md"
Write-Host ""

Write-Host "[3/3] Installing Revenue Radar skill..."
hermes skills install "https://raw.githubusercontent.com/lickovci-cpu/Business-Control-ONE-17-MAX-/main/hermes-skills/revenue-radar/SKILL.md"
Write-Host ""

Write-Host "=== VERIFY ==="
hermes skills list
Write-Host ""
Write-Host "Bootstrap finished. Start a NEW Hermes session so the skills enter the fresh-session prompt."
