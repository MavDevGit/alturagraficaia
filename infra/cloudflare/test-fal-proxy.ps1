param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')]
  [string]$ProjectId,
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^https://[A-Za-z0-9.-]+/?$')]
  [string]$FalProxyUrl
)

$ErrorActionPreference = 'Stop'
$ProxyUrl = $FalProxyUrl.TrimEnd('/')
$ProxyHost = ([Uri]$ProxyUrl).DnsSafeHost
$AaaaRecords = Resolve-DnsName -Name $ProxyHost -Type AAAA -DnsOnly -ErrorAction Stop |
  Where-Object { $_.Type -eq 'AAAA' -and $_.IPAddress }
if (-not $AaaaRecords) { throw 'El proxy no publica registros IPv6 AAAA.' }

& curl.exe -6fsS --max-time 15 "$ProxyUrl/healthz" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'El proxy no responde por IPv6.' }

$Secret = gcloud secrets versions access latest --secret=fal-proxy-hmac-secret --project=$ProjectId
if ($LASTEXITCODE -ne 0 -or $Secret.Length -lt 32 -or $Secret -match '\s') {
  throw 'No se pudo leer un secreto HMAC valido.'
}

try {
  $Path = '/v1/rest/.well-known/jwks.json'
  $Timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds().ToString()
  $EmptyHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
  $Canonical = "v1`n$Timestamp`nGET`n$Path`n$EmptyHash"
  $Hmac = [Security.Cryptography.HMACSHA256]::new([Text.Encoding]::UTF8.GetBytes($Secret))
  try {
    $Signature = ([BitConverter]::ToString(
      $Hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes($Canonical))
    ) -replace '-', '').ToLowerInvariant()
  } finally {
    $Hmac.Dispose()
  }

  $Response = Invoke-WebRequest -UseBasicParsing -Uri "$ProxyUrl$Path" -Headers @{
    'X-Altura-Timestamp' = $Timestamp
    'X-Altura-Signature' = $Signature
  } -TimeoutSec 20
  $Payload = $Response.Content | ConvertFrom-Json
  if ($Response.StatusCode -ne 200 -or @($Payload.keys).Count -lt 1) {
    throw 'El proxy no devolvio las claves publicas de FAL.'
  }
  Write-Output "Proxy FAL valido: IPv6, HMAC y upstream verificados ($(@($Payload.keys).Count) JWKS)."
} finally {
  $Secret = $null
  $Signature = $null
}
