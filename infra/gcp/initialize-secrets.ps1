param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [Parameter(Mandatory=$true)][string]$SourceEnvPath,
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^https://[A-Za-z0-9.-]+/?$')]
  [string]$FalProxyUrl
)

$ErrorActionPreference = 'Stop'
$GcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
if (-not $GcloudCommand) { $GcloudCommand = Get-Command gcloud -ErrorAction Stop }
$Gcloud = $GcloudCommand.Source

function Assert-Gcloud([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "gcloud no pudo completar: $Action" }
}

function Has-EnabledVersion([string]$Name) {
  $version = & $Gcloud secrets versions list $Name --project=$ProjectId --filter='state=ENABLED' --limit=1 --format='value(name)'
  Assert-Gcloud "consultar $Name"
  return [bool]$version
}

function Add-SecretValue([string]$Name, [string]$Value) {
  $temporaryFile = [IO.Path]::GetTempFileName()
  try {
    [IO.File]::WriteAllText($temporaryFile, $Value, (New-Object Text.UTF8Encoding($false)))
    & $Gcloud secrets versions add $Name --project=$ProjectId --data-file=$temporaryFile | Out-Null
    Assert-Gcloud "agregar version de $Name"
  } finally {
    $Value = $null
    if (Test-Path -LiteralPath $temporaryFile) {
      $length = (Get-Item -LiteralPath $temporaryFile).Length
      if ($length -gt 0) { [IO.File]::WriteAllBytes($temporaryFile, (New-Object byte[] $length)) }
      Remove-Item -LiteralPath $temporaryFile -Force
    }
  }
}

function New-RandomSecret {
  $bytes = New-Object byte[] 48
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $random.GetBytes($bytes)
    return [Convert]::ToBase64String($bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  } finally {
    $random.Dispose()
    [Array]::Clear($bytes, 0, $bytes.Length)
  }
}

if (-not (Test-Path -LiteralPath $SourceEnvPath -PathType Leaf)) { throw 'No existe el archivo de entorno local indicado.' }
$falLine = Get-Content -LiteralPath $SourceEnvPath | Where-Object { $_ -match '^FAL_KEY=' } | Select-Object -First 1
if (-not $falLine) { throw 'El archivo local no contiene FAL_KEY.' }
$falValue = $falLine.Substring(8).Trim().Trim('"').Trim("'")
if ($falValue.Length -lt 16 -or $falValue -match '\s') { throw 'La FAL_KEY local no tiene un formato valido.' }

if (-not (Has-EnabledVersion 'fal-key')) { Add-SecretValue 'fal-key' $falValue }
$falValue = $null
if (-not (Has-EnabledVersion 'fal-proxy-hmac-secret')) {
  $generated = New-RandomSecret
  Add-SecretValue 'fal-proxy-hmac-secret' $generated
  $generated = $null
}
if (-not (Has-EnabledVersion 'fal-proxy-url')) { Add-SecretValue 'fal-proxy-url' $FalProxyUrl.TrimEnd('/') }
if (-not (Has-EnabledVersion 'backup-encryption-key')) {
  $generated = New-RandomSecret
  Add-SecretValue 'backup-encryption-key' $generated
  $generated = $null
}

Write-Output 'FAL, su proxy y el cifrado de backups tienen una version habilitada.'
