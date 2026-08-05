param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [string]$Repository = 'MavDevGit/alturagraficaia',
  [string]$Pool = 'github-actions',
  [string]$Provider = 'github-altura'
)
$ErrorActionPreference = 'Stop'
$GcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
if (-not $GcloudCommand) { $GcloudCommand = Get-Command gcloud -ErrorAction Stop }
$Gcloud = $GcloudCommand.Source
function Assert-Gcloud([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "gcloud no pudo completar: $Action" }
}
function Test-Gcloud([string[]]$Arguments) {
  $ErrorActionPreference = 'SilentlyContinue'
  & $Gcloud @Arguments 2>$null | Out-Null
  return $LASTEXITCODE -eq 0
}

$ProjectNumber = & $Gcloud projects describe $ProjectId --format='value(projectNumber)'
Assert-Gcloud 'obtener número de proyecto'
if (-not (Test-Gcloud @('iam', 'workload-identity-pools', 'describe', $Pool, '--location=global', "--project=$ProjectId"))) {
  & $Gcloud iam workload-identity-pools create $Pool --location=global --project=$ProjectId --display-name='GitHub Actions'
  Assert-Gcloud 'crear pool GitHub'
}

if (-not (Test-Gcloud @('iam', 'workload-identity-pools', 'providers', 'describe', $Provider, "--workload-identity-pool=$Pool", '--location=global', "--project=$ProjectId"))) {
  & $Gcloud iam workload-identity-pools providers create-oidc $Provider --workload-identity-pool=$Pool --location=global --project=$ProjectId --display-name='Altura GitHub' --issuer-uri='https://token.actions.githubusercontent.com' --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner' --attribute-condition="assertion.repository=='$Repository'"
  Assert-Gcloud 'crear provider OIDC exclusivo'
}

$DeploySa = "github-altura-deploy@$ProjectId.iam.gserviceaccount.com"
$Principal = "principalSet://iam.googleapis.com/projects/$ProjectNumber/locations/global/workloadIdentityPools/$Pool/attribute.repository/$Repository"
& $Gcloud iam service-accounts add-iam-policy-binding $DeploySa --project=$ProjectId --member=$Principal --role=roles/iam.workloadIdentityUser | Out-Null
Assert-Gcloud 'autorizar repositorio GitHub'

Write-Output "GCP_WIF_PROVIDER=projects/$ProjectNumber/locations/global/workloadIdentityPools/$Pool/providers/$Provider"
Write-Output "GCP_DEPLOY_SERVICE_ACCOUNT=$DeploySa"
