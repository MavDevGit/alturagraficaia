param(
  [string]$AdminUser = 'postgres',
  [string]$AdminPassword = $env:ALTURA_PG_ADMIN_PASSWORD
)

$ErrorActionPreference = 'Stop'
$candidates = @()
$pathPsql = Get-Command psql -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -ErrorAction SilentlyContinue
if ($pathPsql) { $candidates += $pathPsql }
$candidates += Get-ChildItem 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty FullName
$psql = $candidates | Select-Object -First 1
if (-not $psql) { throw 'No se encontró psql de PostgreSQL 16.' }

if (-not $AdminPassword) {
  $secure = Read-Host 'Contraseña del administrador PostgreSQL' -AsSecureString
  $pointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  try { $AdminPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($pointer) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($pointer) }
}

$sql = @'
SELECT 'CREATE ROLE alturagrafica LOGIN PASSWORD ''change-me-locally'''
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'alturagrafica') \gexec
ALTER ROLE alturagrafica WITH LOGIN PASSWORD 'change-me-locally';
SELECT 'CREATE DATABASE alturagrafica_pwa OWNER alturagrafica ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'alturagrafica_pwa') \gexec
SELECT 'CREATE DATABASE alturagrafica_pwa_test OWNER alturagrafica ENCODING ''UTF8'''
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'alturagrafica_pwa_test') \gexec
'@

$previousPassword = $env:PGPASSWORD
try {
  $env:PGPASSWORD = $AdminPassword
  $sql | & $psql --host=127.0.0.1 --port=5432 --username=$AdminUser --dbname=postgres --set=ON_ERROR_STOP=1
  if ($LASTEXITCODE -ne 0) { throw "psql terminó con código $LASTEXITCODE." }
} finally {
  $env:PGPASSWORD = $previousPassword
}

Write-Host 'Rol alturagrafica y bases de desarrollo/pruebas disponibles.'
