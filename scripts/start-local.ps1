param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$runtimeDirectory = Join-Path $root 'storage\runtime'
$requiredPorts = @(4173, 5173, 8000, 8787, 9099, 4000)

Set-Location $root
New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

$occupied = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in $requiredPorts } |
  Select-Object -ExpandProperty LocalPort -Unique
if ($occupied) {
  throw "Hay puertos locales ocupados: $($occupied -join ', '). Ejecute npm run local:status o npm run local:stop."
}

if (-not $SkipBuild) {
  & npm.cmd run build:local
  if ($LASTEXITCODE -ne 0) { throw 'La compilacion de produccion local fallo.' }
}

$devOut = Join-Path $runtimeDirectory 'dev.out.log'
$devErr = Join-Path $runtimeDirectory 'dev.err.log'
$previewOut = Join-Path $runtimeDirectory 'preview.out.log'
$previewErr = Join-Path $runtimeDirectory 'preview.err.log'

$dev = Start-Process -FilePath 'npm.cmd' -ArgumentList @('run', 'dev') `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput $devOut -RedirectStandardError $devErr -PassThru
$preview = Start-Process -FilePath 'npm.cmd' `
  -ArgumentList @('run', 'preview', '-w', 'apps/web', '--', '--host', '127.0.0.1', '--port', '4173', '--strictPort') `
  -WorkingDirectory $root -WindowStyle Hidden `
  -RedirectStandardOutput $previewOut -RedirectStandardError $previewErr -PassThru

[pscustomobject]@{
  StartedAt = (Get-Date).ToString('o')
  DevPid = $dev.Id
  PreviewPid = $preview.Id
} | ConvertTo-Json | Set-Content (Join-Path $runtimeDirectory 'local-processes.json')

$pending = @{
  'Web desarrollo' = 'http://127.0.0.1:5173/'
  'Web produccion local' = 'http://127.0.0.1:4173/'
  'API Laravel' = 'http://127.0.0.1:8000/up'
  'Image Service' = 'http://127.0.0.1:8787/health'
  'Firebase Emulator UI' = 'http://127.0.0.1:4000/'
}
$deadline = (Get-Date).AddSeconds(120)
while ($pending.Count -gt 0 -and (Get-Date) -lt $deadline) {
  foreach ($service in @($pending.Keys)) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $pending[$service] -TimeoutSec 3
      if ($response.StatusCode -eq 200) { $pending.Remove($service) }
    } catch { }
  }
  if ($pending.Count -gt 0) { Start-Sleep -Seconds 1 }
}

if ($pending.Count -gt 0) {
  Write-Host "No iniciaron: $($pending.Keys -join ', ')." -ForegroundColor Red
  Write-Host "Revise $devOut, $devErr, $previewOut y $previewErr."
  exit 1
}

& (Join-Path $PSScriptRoot 'start-cloudflare.ps1')

Write-Host 'Entorno local listo:' -ForegroundColor Green
Write-Host '  Desarrollo:       http://127.0.0.1:5173/'
Write-Host '  Produccion local: http://127.0.0.1:4173/'
Write-Host '  API:              http://127.0.0.1:8000/'
Write-Host '  Firebase UI:      http://127.0.0.1:4000/'
Write-Host '  Cloudflare:       https://alturagrafica.mavdev.cloud/ (protegido hasta configurar Access)'
