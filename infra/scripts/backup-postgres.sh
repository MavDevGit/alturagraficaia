#!/usr/bin/env bash
set -euo pipefail
: "${BACKUP_BUCKET:?BACKUP_BUCKET es obligatorio}"

KEY_FILE=${BACKUP_ENCRYPTION_KEY_FILE:-/etc/altura/backup.key}
DATABASES=${BACKUP_DATABASES:-alturagrafica_pwa}
if [[ ! -r "$KEY_FILE" ]]; then echo "No se puede leer $KEY_FILE." >&2; exit 1; fi

STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

for database in $DATABASES; do
  if [[ ! "$database" =~ ^[a-zA-Z0-9_]+$ ]]; then
    echo "Nombre de base no permitido: $database" >&2
    exit 1
  fi
  if ! runuser -u postgres -- psql --tuples-only --no-align --dbname=postgres --command="SELECT 1 FROM pg_database WHERE datname = '$database'" | grep -qx 1; then
    echo "La base $database no existe." >&2
    exit 1
  fi
  runuser -u postgres -- pg_dump --format=custom --compress=9 "$database" > "$TMP/$database.dump"
  openssl enc -aes-256-cbc -pbkdf2 -salt -in "$TMP/$database.dump" -out "$TMP/$database.dump.enc" -pass "file:$KEY_FILE"
  gcloud storage cp "$TMP/$database.dump.enc" "gs://${BACKUP_BUCKET}/postgresql/${database}/${STAMP}.dump.enc"
done
