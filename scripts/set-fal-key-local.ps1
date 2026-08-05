param(
  [Parameter(Mandatory=$true)]
  [string]$WebhookUrl
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$imageEnv = Join-Path $root 'apps\image-service\.env'
$apiEnv = Join-Path $root 'apps\api\.env'
$secretPointer = [IntPtr]::Zero
$plainSecret = $null

try {
  $webhook = [Uri]$WebhookUrl
} catch {
  throw 'WebhookUrl no es una URL valida.'
}
if ($webhook.Scheme -ne 'https' -or $webhook.AbsolutePath -ne '/webhooks/fal') {
  throw 'WebhookUrl debe ser una URL HTTPS publica que termine exactamente en /webhooks/fal.'
}
if ($webhook.IsLoopback -or $webhook.Host -match '(^|\.)example\.(com|net|org)$') {
  throw 'WebhookUrl debe usar el hostname publico real del tunel, no localhost ni example.com.'
}

function Set-EnvValue([string]$Path, [string]$Name, [string]$Value) {
  $lines = [Collections.Generic.List[string]]::new()
  if (Test-Path -LiteralPath $Path) {
    foreach ($line in [IO.File]::ReadAllLines($Path)) { $lines.Add($line) }
  }
  $found = $false
  for ($index = 0; $index -lt $lines.Count; $index++) {
    if ($lines[$index].StartsWith("$Name=")) {
      $lines[$index] = "$Name=$Value"
      $found = $true
      break
    }
  }
  if (-not $found) { $lines.Add("$Name=$Value") }
  [IO.File]::WriteAllLines($Path, $lines, (New-Object Text.UTF8Encoding($false)))
}

try {
  $secureSecret = Read-Host 'Pegue su FAL_KEY local (la entrada permanecera oculta)' -AsSecureString
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
  $plainSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)
  if ([string]::IsNullOrWhiteSpace($plainSecret) -or $plainSecret.Length -lt 16) {
    throw 'La FAL_KEY parece vacia o demasiado corta.'
  }
  if ($plainSecret -match '[\s#]') {
    throw 'La FAL_KEY no puede contener espacios, saltos de linea ni #.'
  }

  Set-EnvValue $imageEnv 'FAL_KEY' $plainSecret
  $plainSecret = $null
  Set-EnvValue $imageEnv 'PROCESSING_DRIVER' 'fal'
  Set-EnvValue $imageEnv 'FAL_WEBHOOK_URL' $webhook.AbsoluteUri.TrimEnd('/')

  $rotationDate = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  Set-EnvValue $apiEnv 'FAL_KEY_CONFIGURED' 'true'
  Set-EnvValue $apiEnv 'FAL_KEY_ROTATED_AT' $rotationDate

  Write-Host 'FAL real habilitado para desarrollo y produccion local.' -ForegroundColor Green
  Write-Host "Webhook: $($webhook.AbsoluteUri)"
  Write-Host "Rotada: $rotationDate"
  Write-Host 'Reinicie con: npm run local:stop; npm run local:start:quick'
} finally {
  $plainSecret = $null
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
}
