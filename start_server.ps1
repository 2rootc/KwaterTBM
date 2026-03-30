$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$pidFile = Join-Path $root '.server.pid'
$python = Get-Command py -ErrorAction SilentlyContinue
$exe = if ($python) { 'py' } else { 'python' }
$command = "Set-Location '$root'; & $exe server.py"

if (Test-Path $pidFile) {
  $existingPid = (Get-Content $pidFile -Raw).Trim()
  if ($existingPid) {
    $existing = Get-Process -Id $existingPid -ErrorAction SilentlyContinue
    if ($existing) {
      Write-Output "Server already running. PID=$existingPid"
      exit 0
    }
  }
}

$process = Start-Process powershell -ArgumentList @('-NoExit', '-Command', $command) -WorkingDirectory $root -WindowStyle Minimized -PassThru
Set-Content -Path $pidFile -Value $process.Id -Encoding ascii
Write-Output "Server window started. PID=$($process.Id)"
