$ErrorActionPreference = 'SilentlyContinue'

$root = Split-Path -Parent $PSScriptRoot
$pidFile = Join-Path $root 'storage\runtime\cloudflared.pid'
$tunnelName = 'alturagrafica-local'

if (-not (Test-Path -LiteralPath $pidFile)) { return }

$processId = [int](Get-Content -LiteralPath $pidFile -Raw).Trim()
$process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
if ($process -and $process.Name -eq 'cloudflared.exe' -and $process.CommandLine -like "*$tunnelName*") {
  Stop-Process -Id $processId -Force
  Write-Host "Tunel Cloudflare detenido ($processId)."
}
Remove-Item -LiteralPath $pidFile -Force
