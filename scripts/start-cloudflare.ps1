$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root 'storage\runtime'
$pidFile = Join-Path $runtimeDirectory 'cloudflared.pid'
$configFile = Join-Path $env:USERPROFILE '.cloudflared\config.yml'
$tunnelName = 'alturagrafica-local'

if (-not (Test-Path -LiteralPath $configFile)) {
  throw "Falta la configuracion de Cloudflare: $configFile"
}

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

$running = Get-CimInstance Win32_Process -Filter "Name = 'cloudflared.exe'" |
  Where-Object { $_.CommandLine -like "*$tunnelName*" } |
  Select-Object -First 1
if ($running) {
  Set-Content -LiteralPath $pidFile -Value $running.ProcessId
  Write-Host "Tunel Cloudflare ya activo (PID $($running.ProcessId))." -ForegroundColor Green
  return
}

$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
  $packageRoot = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  $cloudflared = Get-ChildItem -Path $packageRoot -Recurse -Filter 'cloudflared.exe' -ErrorAction SilentlyContinue |
    Select-Object -First 1
}
if (-not $cloudflared) {
  throw 'cloudflared no esta instalado. Instale Cloudflare.cloudflared con winget.'
}

$executable = if ($cloudflared.Source) { $cloudflared.Source } else { $cloudflared.FullName }
$outLog = Join-Path $runtimeDirectory 'cloudflared.out.log'
$errLog = Join-Path $runtimeDirectory 'cloudflared.err.log'
$process = Start-Process -FilePath $executable `
  -ArgumentList @('--config', $configFile, 'tunnel', 'run', $tunnelName) `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput $outLog -RedirectStandardError $errLog -PassThru

Start-Sleep -Seconds 3
if ($process.HasExited) {
  if (Test-Path -LiteralPath $errLog) { Get-Content -LiteralPath $errLog -Tail 80 }
  throw "cloudflared termino con codigo $($process.ExitCode)."
}

Set-Content -LiteralPath $pidFile -Value $process.Id
Write-Host "Tunel Cloudflare activo (PID $($process.Id))." -ForegroundColor Green
Write-Host '  Publico seguro: https://alturagrafica.mavdev.cloud/health'
Write-Host '  Webhook FAL:    https://alturagrafica.mavdev.cloud/webhooks/fal'
