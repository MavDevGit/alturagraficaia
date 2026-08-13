param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [Parameter(Mandatory=$true)][string]$BackupBucketName,
  [string]$FirebaseProjectId = "altura-grafica-ia-6faf1",
  [string]$Network = "default",
  [string]$Subnet = "default"
)

$ErrorActionPreference = 'Stop'
$GcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
if (-not $GcloudCommand) { $GcloudCommand = Get-Command gcloud -ErrorAction Stop }
$Gcloud = $GcloudCommand.Source
$Region = 'us-central1'
$VmSa = "shared-vm-runtime@$ProjectId.iam.gserviceaccount.com"
$DeploySa = "github-altura-deploy@$ProjectId.iam.gserviceaccount.com"

function Assert-Gcloud([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "gcloud no pudo completar: $Action" }
}

function Test-Gcloud([string[]]$Arguments) {
  $ErrorActionPreference = 'SilentlyContinue'
  & $Gcloud @Arguments 2>$null | Out-Null
  return $LASTEXITCODE -eq 0
}

function Ensure-ServiceAccount([string]$Id, [string]$DisplayName) {
  if (-not (Test-Gcloud @('iam', 'service-accounts', 'describe', "$Id@$ProjectId.iam.gserviceaccount.com", '--project', $ProjectId))) {
    & $Gcloud iam service-accounts create $Id --display-name=$DisplayName --project $ProjectId
    Assert-Gcloud "crear cuenta $Id"
  }
}

function Ensure-Secret([string]$Name) {
  if (-not (Test-Gcloud @('secrets', 'describe', $Name, '--project', $ProjectId))) {
    & $Gcloud secrets create $Name --replication-policy=automatic --project $ProjectId
    Assert-Gcloud "crear secreto $Name"
  }
}

& $Gcloud services enable compute.googleapis.com iap.googleapis.com storage.googleapis.com secretmanager.googleapis.com monitoring.googleapis.com billingbudgets.googleapis.com iamcredentials.googleapis.com sts.googleapis.com identitytoolkit.googleapis.com --project $ProjectId
Assert-Gcloud 'habilitar APIs necesarias'

& $Gcloud compute networks subnets update $Subnet --region=$Region --project=$ProjectId --enable-private-ip-google-access --quiet
Assert-Gcloud 'habilitar acceso privado a las APIs de Google'

if (-not (Test-Gcloud @('storage', 'buckets', 'describe', "gs://$BackupBucketName"))) {
  & $Gcloud storage buckets create "gs://$BackupBucketName" --project=$ProjectId --location=$Region --uniform-bucket-level-access --soft-delete-duration=7d
  Assert-Gcloud 'crear bucket de backups'
}
& $Gcloud storage buckets update "gs://$BackupBucketName" --lifecycle-file=infra/gcp/backup-lifecycle.json --public-access-prevention --soft-delete-duration=7d
Assert-Gcloud 'asegurar bucket privado de backups'

Ensure-ServiceAccount 'shared-vm-runtime' 'Shared production VM runtime'
Ensure-ServiceAccount 'github-altura-deploy' 'GitHub Altura deploy'
Ensure-Secret 'fal-key'
Ensure-Secret 'fal-proxy-hmac-secret'
Ensure-Secret 'fal-proxy-url'
Ensure-Secret 'backup-encryption-key'

& $Gcloud storage buckets add-iam-policy-binding "gs://$BackupBucketName" --member="serviceAccount:$VmSa" --role=roles/storage.objectAdmin | Out-Null
foreach ($secret in @('fal-proxy-hmac-secret', 'fal-proxy-url', 'backup-encryption-key')) {
  & $Gcloud secrets add-iam-policy-binding $secret --project=$ProjectId --member="serviceAccount:$VmSa" --role=roles/secretmanager.secretAccessor | Out-Null
}
& $Gcloud secrets remove-iam-policy-binding fal-key --project=$ProjectId --member="serviceAccount:$VmSa" --role=roles/secretmanager.secretAccessor --quiet 2>$null | Out-Null
Assert-Gcloud 'autorizar backup y secretos del runtime'

& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$VmSa" --role=roles/logging.logWriter | Out-Null
& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$VmSa" --role=roles/monitoring.metricWriter | Out-Null
& $Gcloud projects add-iam-policy-binding $FirebaseProjectId --member="serviceAccount:$VmSa" --role=roles/firebaseauth.viewer | Out-Null
Assert-Gcloud 'autorizar runtime de VM'

& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$DeploySa" --role=roles/compute.viewer | Out-Null
& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$DeploySa" --role=roles/iap.tunnelResourceAccessor | Out-Null
& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$DeploySa" --role=roles/compute.osAdminLogin | Out-Null
& $Gcloud iam service-accounts add-iam-policy-binding $VmSa --project=$ProjectId --member="serviceAccount:$DeploySa" --role=roles/iam.serviceAccountUser | Out-Null
Assert-Gcloud 'autorizar despliegue de VM desde GitHub'

Write-Host 'Infraestructura minima preparada: VM privada, proxy FAL, PostgreSQL y backup cifrado.'
