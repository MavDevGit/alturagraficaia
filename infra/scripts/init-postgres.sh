#!/usr/bin/env bash
set -euo pipefail
: "${ALTURA_DB_PASSWORD:?Defina ALTURA_DB_PASSWORD temporalmente}"

runuser -u postgres -- psql --set=ON_ERROR_STOP=1 --set=db_password="$ALTURA_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE alturagrafica LOGIN PASSWORD %L', :'db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'alturagrafica')\gexec
ALTER ROLE alturagrafica PASSWORD :'db_password';
SQL

if ! runuser -u postgres -- psql --tuples-only --no-align --command="SELECT 1 FROM pg_database WHERE datname = 'alturagrafica_pwa'" | grep -qx 1; then
  runuser -u postgres -- createdb --owner=alturagrafica --encoding=UTF8 alturagrafica_pwa
fi
echo 'PostgreSQL preparado. Borre ALTURA_DB_PASSWORD del entorno actual.'
