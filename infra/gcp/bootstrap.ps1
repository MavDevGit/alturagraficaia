param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [Parameter(Mandatory=$true)][string]$MediaBucketName,
  [Parameter(Mandatory=$true)][string]$BackupBucketName,
  [string]$FirebaseProjectId = "altura-grafica-ia"
)
$ErrorActionPreference = 'Stop'
$GcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
if (-not $GcloudCommand) { $GcloudCommand = Get-Command gcloud -ErrorAction Stop }
$Gcloud = $GcloudCommand.Source
$Region = 'us-central1'
$WorkerSa = "altura-image-worker@$ProjectId.iam.gserviceaccount.com"
$WebhookSa = "altura-image-webhook@$ProjectId.iam.gserviceaccount.com"
$TasksInvokerSa = "altura-tasks-invoker@$ProjectId.iam.gserviceaccount.com"
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

& $Gcloud config set project $ProjectId
Assert-Gcloud 'seleccionar el proyecto'
& $Gcloud services enable run.googleapis.com storage.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com monitoring.googleapis.com iamcredentials.googleapis.com cloudtasks.googleapis.com --project $ProjectId
Assert-Gcloud 'habilitar APIs'

if (-not (Test-Gcloud @('storage', 'buckets', 'describe', "gs://$MediaBucketName"))) {
  & $Gcloud storage buckets create "gs://$MediaBucketName" --project=$ProjectId --location=$Region --uniform-bucket-level-access
  Assert-Gcloud 'crear bucket de medios'
}
& $Gcloud storage buckets update "gs://$MediaBucketName" --lifecycle-file=infra/gcp/storage-lifecycle.json --public-access-prevention --clear-soft-delete
Assert-Gcloud 'asegurar bucket efímero de medios'

if (-not (Test-Gcloud @('storage', 'buckets', 'describe', "gs://$BackupBucketName"))) {
  & $Gcloud storage buckets create "gs://$BackupBucketName" --project=$ProjectId --location=$Region --uniform-bucket-level-access --soft-delete-duration=7d
  Assert-Gcloud 'crear bucket de backups'
}
& $Gcloud storage buckets update "gs://$BackupBucketName" --lifecycle-file=infra/gcp/backup-lifecycle.json --public-access-prevention --soft-delete-duration=7d
Assert-Gcloud 'asegurar bucket de backups'

if (-not (Test-Gcloud @('artifacts', 'repositories', 'describe', 'altura', "--location=$Region", "--project=$ProjectId"))) {
  & $Gcloud artifacts repositories create altura --repository-format=docker --location=$Region --project=$ProjectId
  Assert-Gcloud 'crear Artifact Registry'
}
& $Gcloud artifacts repositories set-cleanup-policies altura --location=$Region --project=$ProjectId --policy=infra/gcp/artifact-cleanup.json --quiet
Assert-Gcloud 'limitar retención de imágenes de contenedor'

Ensure-ServiceAccount 'altura-image-worker' 'Altura image worker'
Ensure-ServiceAccount 'altura-image-webhook' 'Altura FAL webhook receiver'
Ensure-ServiceAccount 'altura-tasks-invoker' 'Altura Cloud Tasks invoker'
Ensure-ServiceAccount 'shared-vm-runtime' 'Shared production VM runtime'
Ensure-ServiceAccount 'github-altura-deploy' 'GitHub Altura deploy'

foreach ($secret in @('fal-key', 'image-internal-key', 'image-callback-secret')) { Ensure-Secret $secret }

& $Gcloud storage buckets add-iam-policy-binding "gs://$MediaBucketName" --member="serviceAccount:$WorkerSa" --role=roles/storage.objectAdmin | Out-Null
& $Gcloud storage buckets add-iam-policy-binding "gs://$MediaBucketName" --member="serviceAccount:$WebhookSa" --role=roles/storage.objectViewer | Out-Null
& $Gcloud storage buckets add-iam-policy-binding "gs://$MediaBucketName" --member="serviceAccount:$VmSa" --role=roles/storage.objectAdmin | Out-Null
& $Gcloud storage buckets add-iam-policy-binding "gs://$BackupBucketName" --member="serviceAccount:$VmSa" --role=roles/storage.objectAdmin | Out-Null
Assert-Gcloud 'autorizar buckets'

foreach ($secret in @('fal-key', 'image-internal-key', 'image-callback-secret')) {
  & $Gcloud secrets add-iam-policy-binding $secret --project=$ProjectId --member="serviceAccount:$WorkerSa" --role=roles/secretmanager.secretAccessor | Out-Null
}
& $Gcloud secrets add-iam-policy-binding image-internal-key --project=$ProjectId --member="serviceAccount:$WebhookSa" --role=roles/secretmanager.secretAccessor | Out-Null
Assert-Gcloud 'autorizar secretos por recurso'

& $Gcloud iam service-accounts add-iam-policy-binding $WorkerSa --project=$ProjectId --member="serviceAccount:$WorkerSa" --role=roles/iam.serviceAccountTokenCreator | Out-Null
& $Gcloud iam service-accounts add-iam-policy-binding $VmSa --project=$ProjectId --member="serviceAccount:$VmSa" --role=roles/iam.serviceAccountTokenCreator | Out-Null
Assert-Gcloud 'autorizar firma de URLs sin claves descargadas'

& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$VmSa" --role=roles/logging.logWriter | Out-Null
& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$VmSa" --role=roles/monitoring.metricWriter | Out-Null
& $Gcloud projects add-iam-policy-binding $FirebaseProjectId --member="serviceAccount:$VmSa" --role=roles/firebaseauth.viewer | Out-Null
Assert-Gcloud 'autorizar runtime de VM'

if (-not (Test-Gcloud @('tasks', 'queues', 'describe', 'altura-image-finalize', "--location=$Region", "--project=$ProjectId"))) {
  & $Gcloud tasks queues create altura-image-finalize --location=$Region --project=$ProjectId --max-concurrent-dispatches=1 --max-dispatches-per-second=1 --max-attempts=5 --max-retry-duration=7200s --min-backoff=10s --max-backoff=300s
  Assert-Gcloud 'crear cola de finalización'
}
& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$WebhookSa" --role=roles/cloudtasks.enqueuer | Out-Null
& $Gcloud iam service-accounts add-iam-policy-binding $TasksInvokerSa --project=$ProjectId --member="serviceAccount:$WebhookSa" --role=roles/iam.serviceAccountUser | Out-Null
& $Gcloud artifacts repositories add-iam-policy-binding altura --location=$Region --project=$ProjectId --member="serviceAccount:$DeploySa" --role=roles/artifactregistry.writer | Out-Null
& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$DeploySa" --role=roles/run.admin | Out-Null
& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$DeploySa" --role=roles/compute.viewer | Out-Null
& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$DeploySa" --role=roles/iap.tunnelResourceAccessor | Out-Null
& $Gcloud projects add-iam-policy-binding $ProjectId --member="serviceAccount:$DeploySa" --role=roles/compute.osAdminLogin | Out-Null
foreach ($runtimeSa in @($WorkerSa, $WebhookSa)) {
  & $Gcloud iam service-accounts add-iam-policy-binding $runtimeSa --project=$ProjectId --member="serviceAccount:$DeploySa" --role=roles/iam.serviceAccountUser | Out-Null
}
Assert-Gcloud 'autorizar despliegue GitHub con mínimo privilegio'

Write-Host 'Infraestructura base preparada. Añada una sola versión activa a cada secreto antes de desplegar.'
