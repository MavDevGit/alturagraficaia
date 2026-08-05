param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [Parameter(Mandatory=$true)][string]$BucketName,
  [Parameter(Mandatory=$true)][string]$CallbackUrl,
  [Parameter(Mandatory=$true)][string]$ImageTag,
  [string]$VmServiceAccountEmail = "shared-vm-runtime@PROJECT_ID.iam.gserviceaccount.com"
)
$ErrorActionPreference = 'Stop'
$GcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
if (-not $GcloudCommand) { $GcloudCommand = Get-Command gcloud -ErrorAction Stop }
$Gcloud = $GcloudCommand.Source
$Region = 'us-central1'
$WorkerRendered = Join-Path $env:TEMP "altura-worker-$([guid]::NewGuid()).yaml"
$WebhookRendered = Join-Path $env:TEMP "altura-webhook-$([guid]::NewGuid()).yaml"
function Assert-Gcloud([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "gcloud no pudo completar: $Action" }
}

try {
  foreach ($secret in @('fal-key', 'image-internal-key', 'image-callback-secret')) {
    $version = & $Gcloud secrets versions list $secret --project=$ProjectId --filter='state=ENABLED' --limit=1 --format='value(name)'
    Assert-Gcloud "consultar $secret"
    if (-not $version) { throw "El secreto $secret no tiene una versión habilitada." }
  }

  if ($VmServiceAccountEmail -eq 'shared-vm-runtime@PROJECT_ID.iam.gserviceaccount.com') {
    $VmServiceAccountEmail = $VmServiceAccountEmail.Replace('PROJECT_ID', $ProjectId)
  }

  $worker = Get-Content infra/gcp/cloud-run-service.yaml -Raw
  $worker = $worker.Replace('PROJECT_ID', $ProjectId).Replace('BUCKET_NAME', $BucketName).Replace('IMAGE_TAG', $ImageTag)
  $worker = $worker.Replace('https://app.example.com/api/internal/image-callback', $CallbackUrl)
  [IO.File]::WriteAllText($WorkerRendered, $worker, (New-Object Text.UTF8Encoding($false)))
  & $Gcloud run services replace $WorkerRendered --region=$Region --project=$ProjectId --quiet
  Assert-Gcloud 'desplegar worker privado'
  $WorkerUrl = & $Gcloud run services describe altura-image-worker --region=$Region --project=$ProjectId --format='value(status.url)'
  Assert-Gcloud 'consultar URL del worker'

  $webhook = Get-Content infra/gcp/cloud-run-webhook.yaml -Raw
  $webhook = $webhook.Replace('PROJECT_ID', $ProjectId).Replace('BUCKET_NAME', $BucketName).Replace('IMAGE_TAG', $ImageTag).Replace('WORKER_URL', $WorkerUrl)
  [IO.File]::WriteAllText($WebhookRendered, $webhook, (New-Object Text.UTF8Encoding($false)))
  & $Gcloud run services replace $WebhookRendered --region=$Region --project=$ProjectId --quiet
  Assert-Gcloud 'desplegar receptor público de webhook'
  $WebhookUrl = & $Gcloud run services describe altura-image-webhook --region=$Region --project=$ProjectId --format='value(status.url)'
  Assert-Gcloud 'consultar URL del webhook'

  & $Gcloud run services update altura-image-worker --region=$Region --project=$ProjectId --update-env-vars="FAL_WEBHOOK_URL=$WebhookUrl/webhooks/fal" --quiet
  Assert-Gcloud 'conectar FAL con el receptor dedicado'
  & $Gcloud run services add-iam-policy-binding altura-image-webhook --region=$Region --project=$ProjectId --member=allUsers --role=roles/run.invoker --quiet | Out-Null
  & $Gcloud run services add-iam-policy-binding altura-image-worker --region=$Region --project=$ProjectId --member="serviceAccount:altura-tasks-invoker@$ProjectId.iam.gserviceaccount.com" --role=roles/run.invoker --quiet | Out-Null
  & $Gcloud run services add-iam-policy-binding altura-image-worker --region=$Region --project=$ProjectId --member="serviceAccount:$VmServiceAccountEmail" --role=roles/run.invoker --quiet | Out-Null
  Assert-Gcloud 'aplicar invocadores mínimos'

  Write-Output "WORKER_URL=$WorkerUrl"
  Write-Output "WEBHOOK_URL=$WebhookUrl"
} finally {
  foreach ($file in @($WorkerRendered, $WebhookRendered)) {
    if (Test-Path -LiteralPath $file) { Remove-Item -LiteralPath $file -Force }
  }
}
