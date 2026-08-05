param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')]
  [string]$ProjectId
)

$ErrorActionPreference = 'Stop'
$SecretName = 'fal-key'
$temporaryFile = $null
$secretPointer = [IntPtr]::Zero
$plainSecret = $null

if (-not (Get-Command gcloud -ErrorAction SilentlyContinue)) {
  throw 'No se encontro gcloud. Instale Google Cloud CLI e inicie sesion antes de continuar.'
}

gcloud secrets describe $SecretName --project=$ProjectId 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  gcloud secrets create $SecretName --replication-policy=automatic --project=$ProjectId
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el secreto fal-key.' }
}

try {
  $secureSecret = Read-Host 'Pegue su FAL_KEY (la entrada permanecera oculta)' -AsSecureString
  $secretPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureSecret)
  $plainSecret = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($secretPointer)

  if ([string]::IsNullOrWhiteSpace($plainSecret) -or $plainSecret.Length -lt 16) {
    throw 'La FAL_KEY parece vacia o demasiado corta.'
  }
  if ($plainSecret -match '\s') {
    throw 'La FAL_KEY no puede contener espacios ni saltos de linea.'
  }

  $temporaryFile = [IO.Path]::GetTempFileName()
  [IO.File]::WriteAllText(
    $temporaryFile,
    $plainSecret,
    (New-Object Text.UTF8Encoding($false))
  )
  $plainSecret = $null

  gcloud secrets versions add $SecretName --data-file=$temporaryFile --project=$ProjectId
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo agregar la nueva version de fal-key.' }

  $rotationDate = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  Write-Host 'FAL_KEY guardada correctamente en Secret Manager.' -ForegroundColor Green
  Write-Host "Proyecto: $ProjectId"
  Write-Host "Secreto: $SecretName"
  Write-Host "Rotada: $rotationDate"
  Write-Host 'Use esta fecha como FAL_KEY_ROTATED_AT en el .env de la API de produccion.'
} finally {
  $plainSecret = $null
  if ($secretPointer -ne [IntPtr]::Zero) {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($secretPointer)
  }
  if ($temporaryFile -and (Test-Path -LiteralPath $temporaryFile)) {
    $length = (Get-Item -LiteralPath $temporaryFile).Length
    if ($length -gt 0) {
      [IO.File]::WriteAllBytes($temporaryFile, (New-Object byte[] $length))
    }
    Remove-Item -LiteralPath $temporaryFile -Force
  }
}
