$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root '.server.pid'

if (-not (Test-Path $pidFile)) {
  Write-Output 'No PID file found.'
  exit 0
}

$pidValue = (Get-Content $pidFile -Raw).Trim()
if (-not $pidValue) {
  Remove-Item $pidFile -Force
  Write-Output 'Empty PID file removed.'
  exit 0
}

$process = Get-Process -Id $pidValue -ErrorAction SilentlyContinue
if ($process) {
  Stop-Process -Id $pidValue -Force
  Write-Output "Server stopped. PID=$pidValue"
} else {
  Write-Output "Process not found. Removing stale PID file: $pidValue"
}

Remove-Item $pidFile -Force
