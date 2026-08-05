$ErrorActionPreference = 'SilentlyContinue'

$checks = @(
  [pscustomobject]@{ Service = 'Web desarrollo'; Url = 'http://127.0.0.1:5173/' },
  [pscustomobject]@{ Service = 'Web produccion local'; Url = 'http://127.0.0.1:4173/' },
  [pscustomobject]@{ Service = 'API Laravel'; Url = 'http://127.0.0.1:8000/up' },
  [pscustomobject]@{ Service = 'Image Service'; Url = 'http://127.0.0.1:8787/health' },
  [pscustomobject]@{ Service = 'Firebase Emulator UI'; Url = 'http://127.0.0.1:4000/' }
)

$cloudflareConfig = Join-Path $env:USERPROFILE '.cloudflared\config.yml'
if (Test-Path -LiteralPath $cloudflareConfig) {
  $checks += [pscustomobject]@{
    Service = 'Cloudflare Tunnel'
    Url = 'https://alturagrafica.mavdev.cloud/health'
  }
}

$results = foreach ($check in $checks) {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri $check.Url -TimeoutSec 4
    [pscustomobject]@{
      Service = $check.Service
      Status = if ($response.StatusCode -eq 200) { 'OK' } else { "HTTP $($response.StatusCode)" }
      Url = $check.Url
    }
  } catch {
    [pscustomobject]@{ Service = $check.Service; Status = 'DOWN'; Url = $check.Url }
  }
}

$results | Format-Table -AutoSize

$imageEnv = Join-Path (Split-Path -Parent $PSScriptRoot) 'apps\image-service\.env'
$environment = @{}
if (Test-Path -LiteralPath $imageEnv) {
  foreach ($line in [IO.File]::ReadAllLines($imageEnv)) {
    if ($line -match '^([^#=]+)=(.*)$') { $environment[$matches[1]] = $matches[2] }
  }
}
$falEnabled = $environment['PROCESSING_DRIVER'] -eq 'fal'
$falKeyConfigured = -not [string]::IsNullOrWhiteSpace($environment['FAL_KEY'])
Write-Host "Proveedor de imagenes: $(if ($falEnabled) { 'FAL real' } else { 'simulado' })"
Write-Host "FAL_KEY local: $(if ($falKeyConfigured) { 'configurada' } else { 'pendiente' })"
if ($falEnabled) { Write-Host "Webhook FAL: $($environment['FAL_WEBHOOK_URL'])" }

if ($results.Status -contains 'DOWN') { exit 1 }
