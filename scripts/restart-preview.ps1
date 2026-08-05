$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root 'storage\runtime'
$stateFile = Join-Path $runtimeDirectory 'local-processes.json'
$outLog = Join-Path $runtimeDirectory 'preview.out.log'
$errLog = Join-Path $runtimeDirectory 'preview.err.log'

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

$listener = Get-NetTCPConnection -State Listen -LocalPort 4173 -ErrorAction SilentlyContinue |
  Select-Object -First 1
if ($listener) {
  $existing = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
  if (-not $existing -or $existing.CommandLine -notlike '*vite*preview*') {
    throw "El puerto 4173 pertenece a otro proceso ($($listener.OwningProcess))."
  }
  Stop-Process -Id $listener.OwningProcess -Force
}

$preview = Start-Process -FilePath 'npm.cmd' `
  -ArgumentList @('run', 'preview', '-w', 'apps/web', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort') `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru

$deadline = (Get-Date).AddSeconds(30)
do {
  Start-Sleep -Milliseconds 500
  $listener = Get-NetTCPConnection -State Listen -LocalPort 4173 -ErrorAction SilentlyContinue |
    Select-Object -First 1
} while (-not $listener -and (Get-Date) -lt $deadline)

if (-not $listener) {
  if (Test-Path -LiteralPath $errLog) { Get-Content -LiteralPath $errLog -Tail 80 }
  throw 'Vite Preview no inicio en el puerto 4173.'
}

if (Test-Path -LiteralPath $stateFile) {
  $state = Get-Content -LiteralPath $stateFile -Raw | ConvertFrom-Json
} else {
  $state = [pscustomobject]@{ StartedAt = (Get-Date).ToString('o'); DevPid = $null }
}
$state | Add-Member -NotePropertyName PreviewPid -NotePropertyValue $preview.Id -Force
$state | ConvertTo-Json | Set-Content -LiteralPath $stateFile

Write-Host "Produccion local reiniciada en 127.0.0.1:4173 (PID $($preview.Id))." -ForegroundColor Green
