param(
  [Parameter(Mandatory=$true)][string]$ProjectId,
  [Parameter(Mandatory=$true)][string]$BillingAccountId,
  [decimal]$BudgetAmountUsd = 5
)
$ErrorActionPreference = 'Stop'
$GcloudCommand = Get-Command gcloud.cmd -ErrorAction SilentlyContinue
if (-not $GcloudCommand) { $GcloudCommand = Get-Command gcloud -ErrorAction Stop }
$Gcloud = $GcloudCommand.Source
$DisplayName = "Altura Grafica IA - $ProjectId"

function Assert-Gcloud([string]$Action) {
  if ($LASTEXITCODE -ne 0) { throw "gcloud no pudo completar: $Action" }
}

& $Gcloud services enable billingbudgets.googleapis.com --project=$ProjectId --quiet
Assert-Gcloud 'habilitar Billing Budgets API'

$BudgetName = & $Gcloud billing budgets list `
  --billing-account=$BillingAccountId `
  --filter="displayName='$DisplayName'" `
  --format='value(name)' `
  --limit=1
Assert-Gcloud 'consultar presupuesto'

$Amount = "${BudgetAmountUsd}USD"
if ([string]::IsNullOrWhiteSpace($BudgetName)) {
  & $Gcloud billing budgets create `
    --billing-account=$BillingAccountId `
    --display-name=$DisplayName `
    --budget-amount=$Amount `
    --calendar-period=month `
    --filter-projects="projects/$ProjectId" `
    --threshold-rule='percent=0.10' `
    --threshold-rule='percent=0.50' `
    --threshold-rule='percent=0.90' `
    --threshold-rule='percent=1.00' `
    --threshold-rule='percent=1.00,basis=forecasted-spend' `
    --quiet
  Assert-Gcloud 'crear presupuesto'
} else {
  & $Gcloud billing budgets update $BudgetName.Trim() `
    --budget-amount=$Amount `
    --calendar-period=month `
    --filter-projects="projects/$ProjectId" `
    --clear-threshold-rules `
    --add-threshold-rule='percent=0.10' `
    --add-threshold-rule='percent=0.50' `
    --add-threshold-rule='percent=0.90' `
    --add-threshold-rule='percent=1.00' `
    --add-threshold-rule='percent=1.00,basis=forecasted-spend' `
    --quiet
  Assert-Gcloud 'actualizar presupuesto'
}

& $Gcloud billing budgets list `
  --billing-account=$BillingAccountId `
  --filter="displayName='$DisplayName'" `
  --format='table(displayName,amount.specifiedAmount.units,thresholdRules.thresholdPercent.list())'
Assert-Gcloud 'verificar presupuesto'
