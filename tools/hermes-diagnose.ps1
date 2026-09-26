# Hermes Agent diagnostic for Windows
# Safe by design: collects configuration/status metadata and does not print secret values.
# Run in PowerShell where the Hermes installation you want to inspect is available.

$ErrorActionPreference = 'Continue'
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$out = Join-Path $PWD "hermes-diagnostic-$stamp.txt"

"=== HERMES WINDOWS DIAGNOSTIC ===" | Tee-Object $out
"Collected: $(Get-Date -Format o)" | Tee-Object $out -Append
"Computer: $env:COMPUTERNAME" | Tee-Object $out -Append
"OS: $([System.Environment]::OSVersion.VersionString)" | Tee-Object $out -Append
"PowerShell: $($PSVersionTable.PSVersion)" | Tee-Object $out -Append
"" | Tee-Object $out -Append

function Run-Redacted([string]$Label, [scriptblock]$Command) {
  "----- $Label -----" | Tee-Object $out -Append
  try {
    $text = (& $Command 2>&1 | Out-String)
    $text = $text -replace '(?im)^(.{0,80}(?:api[_ -]?key|token|secret|password|authorization|cookie).{0,200})$','$1 [REDACTED]'
    $text = $text -replace '(?i)(Bearer\s+)[A-Za-z0-9._~+/=-]+','$1[REDACTED]'
    $text = $text -replace '(?i)(sk-[A-Za-z0-9_-]+)','$1[REDACTED]'
    $text.TrimEnd() | Tee-Object $out -Append
  } catch {
    "ERROR: $($_.Exception.Message)" | Tee-Object $out -Append
  }
  "" | Tee-Object $out -Append
}

if (-not (Get-Command hermes -ErrorAction SilentlyContinue)) {
  "ERROR: 'hermes' is not on PATH in this PowerShell session." | Tee-Object $out -Append
  "Run this from the shell where Hermes itself is installed." | Tee-Object $out -Append
  Write-Host "Diagnostic saved to $out"
  exit 1
}

Run-Redacted "hermes --version" { hermes --version }
Run-Redacted "hermes dump" { hermes dump }
Run-Redacted "hermes doctor" { hermes doctor }
Run-Redacted "hermes status --all" { hermes status --all }
Run-Redacted "hermes tools --summary" { hermes tools --summary }
Run-Redacted "hermes profile list" { hermes profile list }
Run-Redacted "hermes cron list" { hermes cron list }
Run-Redacted "hermes cron status" { hermes cron status }
Run-Redacted "hermes gateway list" { hermes gateway list }
Run-Redacted "hermes computer-use status" { hermes computer-use status }
Run-Redacted "hermes portal status" { hermes portal status }
Run-Redacted "hermes plugins list" { hermes plugins list }
Run-Redacted "hermes skills list" { hermes skills list }

"=== END ===" | Tee-Object $out -Append
Write-Host "Diagnostic saved to: $out"
