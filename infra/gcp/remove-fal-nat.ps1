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

$proxyHost = ([Uri]$proxy).DnsSafeHost
$aaaa = Resolve-DnsName -Name $proxyHost -Type AAAA -DnsOnly -ErrorAction Stop |
  Where-Object { $_.Type -eq 'AAAA' -and $_.IPAddress }
if (-not $aaaa) { throw 'El proxy FAL no publica conectividad IPv6.' }

& curl.exe -6fsS --max-time 15 "$proxy/healthz" | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'El proxy FAL no responde por IPv6.' }

& $Gcloud compute networks subnets update $Subnet --region=$Region --project=$ProjectId --enable-private-ip-google-access --quiet
Assert-Gcloud 'habilitar acceso privado a APIs de Google'

$remoteCheck = "set -euo pipefail; curl -6fsS --max-time 15 '$proxy/healthz' >/dev/null; code=`$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 https://secretmanager.googleapis.com/); [[ `$code =~ ^(200|400|401|403|404)$ ]]"
& $Gcloud compute ssh $VmName --zone=$VmZone --project=$ProjectId --tunnel-through-iap --quiet --command=$remoteCheck
Assert-Gcloud 'validar proxy IPv6 y APIs de Google desde la VM'

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

Write-Output 'Cloud NAT y su router dedicado fueron eliminados despues de validar el proxy IPv6.'
