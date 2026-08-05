$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

foreach ($app in @('apps/api', 'apps/web', 'apps/image-service')) {
  $target = Join-Path $app '.env'
  if (-not (Test-Path $target)) { Copy-Item (Join-Path $app '.env.example') $target }
}

npm install
npm run contracts

if ($env:ALTURA_PG_ADMIN_PASSWORD) {
  & (Join-Path $PSScriptRoot 'create-databases.ps1') -AdminPassword $env:ALTURA_PG_ADMIN_PASSWORD
}

$phpCandidates = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.*\php.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
$php = $phpCandidates | Where-Object { [int](& $_.FullName -r "echo PHP_VERSION_ID;") -ge 80300 } | Select-Object -First 1
if (-not $php) { throw 'Se requiere PHP 8.3 o superior.' }
$composer = Get-ChildItem "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\PHP.PHP.*\composer.phar" -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $composer) { throw 'No se encontró composer.phar.' }
& $php.FullName $composer.FullName install --working-dir=apps/api --no-interaction
if ($LASTEXITCODE -ne 0) { throw 'Composer no pudo instalar las dependencias de Laravel.' }
& $php.FullName apps/api/artisan key:generate
if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar APP_KEY.' }

& $php.FullName apps/api/artisan migrate --seed
if ($LASTEXITCODE -ne 0) {
  Write-Warning 'PostgreSQL no está listo. Ejecute scripts/create-databases.ps1 y vuelva a ejecutar npm run setup.'
}
npm run build
Write-Host 'Configuración finalizada. Use npm run dev para iniciar los cinco servicios.'
