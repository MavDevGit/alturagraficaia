param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')]
  [string]$ProjectId,
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^https://[A-Za-z0-9.-]+/?$')]
  [string]$FalProxyUrl,
  [switch]$SkipDeploy
)

$ErrorActionPreference = 'Stop'
$RepositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$WorkerRoot = Join-Path $RepositoryRoot 'workers\fal-proxy'
$TemporaryRoot = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
$FalFile = [IO.Path]::GetTempFileName()
$HmacFile = [IO.Path]::GetTempFileName()
$UrlFile = [IO.Path]::GetTempFileName()

function Assert-ExitCode([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "No se pudo completar: $Action" }
}

function Ensure-Secret([string]$Name) {
  $ErrorActionPreference = 'SilentlyContinue'
  gcloud secrets describe $Name --project=$ProjectId 2>$null | Out-Null
  $exists = $LASTEXITCODE -eq 0
  $ErrorActionPreference = 'Stop'
  if (-not $exists) {
    gcloud secrets create $Name --replication-policy=automatic --project=$ProjectId | Out-Null
    Assert-ExitCode "crear $Name"
  }
}

try {
  gcloud secrets versions access latest --secret=fal-key --project=$ProjectId --out-file=$FalFile | Out-Null
  Assert-ExitCode 'leer fal-key'
  $FalValue = [IO.File]::ReadAllText($FalFile).Trim()
  if ($FalValue.Length -lt 16 -or $FalValue -match '\s') { throw 'fal-key no es valida.' }

  $RandomBytes = New-Object byte[] 48
  $Random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $Random.GetBytes($RandomBytes) } finally { $Random.Dispose() }
  $HmacValue = [Convert]::ToBase64String($RandomBytes).TrimEnd('=').Replace('+', '-').Replace('/', '_')
  [Array]::Clear($RandomBytes, 0, $RandomBytes.Length)
  [IO.File]::WriteAllText($HmacFile, $HmacValue, (New-Object Text.UTF8Encoding($false)))
  [IO.File]::WriteAllText($UrlFile, $FalProxyUrl.TrimEnd('/'), (New-Object Text.UTF8Encoding($false)))

  Push-Location $WorkerRoot
  try {
    if (-not $SkipDeploy) {
      npm run deploy
      Assert-ExitCode 'desplegar Worker'
    }
    Get-Content -Raw -LiteralPath $FalFile | npx wrangler secret put FAL_KEY
    Assert-ExitCode 'configurar FAL_KEY en Worker'
    Get-Content -Raw -LiteralPath $HmacFile | npx wrangler secret put PROXY_HMAC_SECRET
    Assert-ExitCode 'configurar HMAC en Worker'
  } finally {
    Pop-Location
  }

  Ensure-Secret 'fal-proxy-hmac-secret'
  Ensure-Secret 'fal-proxy-url'
  gcloud secrets versions add fal-proxy-hmac-secret --project=$ProjectId --data-file=$HmacFile | Out-Null
  Assert-ExitCode 'guardar HMAC en Secret Manager'
  gcloud secrets versions add fal-proxy-url --project=$ProjectId --data-file=$UrlFile | Out-Null
  Assert-ExitCode 'guardar URL en Secret Manager'

  Write-Output 'Worker y Secret Manager configurados sin exponer secretos.'
} finally {
  $FalValue = $null
  $HmacValue = $null
  foreach ($TemporaryFile in @($FalFile, $HmacFile, $UrlFile)) {
    $ResolvedTemporaryFile = [IO.Path]::GetFullPath($TemporaryFile)
    if ($ResolvedTemporaryFile.StartsWith($TemporaryRoot) -and (Test-Path -LiteralPath $ResolvedTemporaryFile)) {
      $Length = (Get-Item -LiteralPath $ResolvedTemporaryFile).Length
      if ($Length -gt 0) { [IO.File]::WriteAllBytes($ResolvedTemporaryFile, (New-Object byte[] $Length)) }
      Remove-Item -LiteralPath $ResolvedTemporaryFile -Force
    }
  }
}
