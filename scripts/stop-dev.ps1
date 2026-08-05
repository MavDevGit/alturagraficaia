$tunnelStop = Join-Path $PSScriptRoot 'stop-cloudflare.ps1'
if (Test-Path -LiteralPath $tunnelStop) { & $tunnelStop }

$ports = @(4173, 5173, 8000, 8787, 9099, 4000, 4400, 4500)
$processIds = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in $ports } |
  Select-Object -ExpandProperty OwningProcess -Unique

foreach ($processId in $processIds) {
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $processId -Force
    Write-Host "Detenido $($process.ProcessName) ($processId)."
  }
}
