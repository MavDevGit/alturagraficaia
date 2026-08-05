param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [Parameter(Mandatory=$true)][string]$SourceEnvPath
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
    Assert-Gcloud "agregar versión de $Name"
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
  $random = New-Object Security.Cryptography.RNGCryptoServiceProvider
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
if ($falValue.Length -lt 32 -or $falValue -match '\s') { throw 'La FAL_KEY local no tiene un formato seguro.' }

if (-not (Has-EnabledVersion 'fal-key')) { Add-SecretValue 'fal-key' $falValue }
$falValue = $null
foreach ($secretName in @('image-internal-key', 'image-callback-secret', 'backup-encryption-key')) {
  if (-not (Has-EnabledVersion $secretName)) {
    $generated = New-RandomSecret
    Add-SecretValue $secretName $generated
    $generated = $null
  }
}

Write-Output 'Los cuatro secretos tienen al menos una versión habilitada.'
