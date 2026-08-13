param(
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^[a-z][a-z0-9-]{4,28}[a-z0-9]$')]
  [string]$ProjectId,
  [Parameter(Mandatory=$true)]
  [ValidatePattern('^https://[A-Za-z0-9.-]+/?$')]
  [string]$FalProxyUrl,
  [string]$VmName = 'gigantografia-prod',
  [string]$VmZone = 'us-central1-a',
  [string]$Network = 'default',
  [string]$Subnet = 'default',
  [switch]$Execute
)

$ErrorActionPreference = 'Stop'
$Region = 'us-central1'
$Router = 'shared-vm-egress-router'
$Nat = 'shared-vm-egress-nat'
$GcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
if (-not $GcloudCommand) { $GcloudCommand = Get-Command gcloud -ErrorAction Stop }
$Gcloud = $GcloudCommand.Source
$proxy = $FalProxyUrl.TrimEnd('/')

function Assert-Gcloud([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "gcloud no pudo completar: $Action" }
}

function Test-Gcloud([string[]]$Arguments) {
  $ErrorActionPreference = 'SilentlyContinue'
  & $Gcloud @Arguments 2>$null | Out-Null
  $succeeded = $LASTEXITCODE -eq 0
  $ErrorActionPreference = 'Stop'
  return $succeeded
}

function Test-RemoteConnectivity {
  $remoteScript = @'
set -euo pipefail
curl -6fsS --max-time 15 '__PROXY_URL__/healthz' >/dev/null
token_response=$(curl -fsS --max-time 10 -H 'Metadata-Flavor: Google' 'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token')
token=$(printf '%s' "$token_response" | php8.3 -r '$j=json_decode(stream_get_contents(STDIN), true); echo $j["access_token"] ?? "";')
[[ -n "$token" ]]
curl -fsS --max-time 15 -H "Authorization: Bearer $token" 'https://secretmanager.googleapis.com/v1/projects/__PROJECT_ID__/secrets/fal-proxy-url/versions/latest:access' >/dev/null
'@
  $remoteScript = $remoteScript.Replace('__PROXY_URL__', $proxy).Replace('__PROJECT_ID__', $ProjectId)
  $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($remoteScript))
  & $Gcloud compute ssh $VmName --zone=$VmZone --project=$ProjectId --tunnel-through-iap --quiet `
    --command="echo $encoded | base64 -d | bash"
  Assert-Gcloud 'validar proxy IPv6 y Secret Manager privado desde la VM'
}

function Restore-Nat {
  if (-not (Test-Gcloud @('compute', 'routers', 'describe', $Router, '--region', $Region, '--project', $ProjectId))) {
    & $Gcloud compute routers create $Router --network=$Network --region=$Region --project=$ProjectId --quiet
    Assert-Gcloud 'recrear Cloud Router durante la reversion'
  }
  if (-not (Test-Gcloud @('compute', 'routers', 'nats', 'describe', $Nat, '--router', $Router, '--region', $Region, '--project', $ProjectId))) {
    & $Gcloud compute routers nats create $Nat --router=$Router --region=$Region --project=$ProjectId `
      --nat-custom-subnet-ip-ranges=$Subnet --auto-allocate-nat-external-ips `
      --enable-endpoint-independent-mapping --min-ports-per-vm=64 --quiet
    Assert-Gcloud 'recrear Cloud NAT durante la reversion'
  }
}

$proxyHost = ([Uri]$proxy).DnsSafeHost
$aaaa = Resolve-DnsName -Name $proxyHost -Type AAAA -DnsOnly -ErrorAction Stop |
  Where-Object { $_.Type -eq 'AAAA' -and $_.IPAddress }
if (-not $aaaa) { throw 'El proxy FAL no publica conectividad IPv6.' }

& curl.exe -6fsS --max-time 15 "$proxy/healthz" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'El proxy FAL no responde por IPv6.' }

& $Gcloud compute networks subnets update $Subnet --region=$Region --project=$ProjectId --enable-private-ip-google-access --quiet
Assert-Gcloud 'habilitar acceso privado a APIs de Google'

Test-RemoteConnectivity

$routerData = & $Gcloud compute routers describe $Router --region=$Region --project=$ProjectId --format=json | ConvertFrom-Json
Assert-Gcloud 'consultar router NAT'
if ($routerData.name -ne $Router -or -not $routerData.network.EndsWith("/networks/$Network")) {
  throw 'El router encontrado no coincide con el recurso dedicado esperado.'
}
$natNames = @($routerData.nats | ForEach-Object { $_.name })
if ($natNames.Count -ne 1 -or $natNames[0] -ne $Nat) {
  throw 'El router contiene configuraciones NAT adicionales; no se eliminara automaticamente.'
}

if (-not $Execute) {
  Write-Output "Validacion completa. Use -Execute para eliminar $Nat y $Router."
  exit 0
}

& $Gcloud compute routers nats delete $Nat --router=$Router --region=$Region --project=$ProjectId --quiet
Assert-Gcloud 'eliminar Cloud NAT dedicado a FAL'
& $Gcloud compute routers delete $Router --region=$Region --project=$ProjectId --quiet
Assert-Gcloud 'eliminar Cloud Router dedicado a FAL'

try {
  Test-RemoteConnectivity
} catch {
  Write-Warning 'La validacion sin NAT fallo; se recreara la salida anterior.'
  Restore-Nat
  throw
}

Write-Output 'Cloud NAT y su router dedicado fueron eliminados; proxy IPv6 y Secret Manager siguen accesibles.'
