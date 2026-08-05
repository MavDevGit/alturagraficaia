#!/usr/bin/env bash
set -euo pipefail
: "${BACKUP_BUCKET:?BACKUP_BUCKET es obligatorio}"

KEY_FILE=${BACKUP_ENCRYPTION_KEY_FILE:-/etc/altura/backup.key}
DATABASES=${BACKUP_DATABASES:-alturagrafica_pwa}
if [[ ! -r "$KEY_FILE" ]]; then echo "No se puede leer $KEY_FILE." >&2; exit 1; fi

STAMP=$(date -u +%Y-%m-%dT%H-%M-%SZ)
TMP=$(mktemp -d /tmp/altura-backup.XXXXXX)
cleanup() {
  if [[ "$TMP" == /tmp/altura-backup.* && -d "$TMP" ]]; then rm -rf -- "$TMP"; fi
}
trap cleanup EXIT

TOKEN_RESPONSE=$(curl -fsS --retry 3 -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token')
ACCESS_TOKEN=$(printf '%s' "$TOKEN_RESPONSE" | php8.3 -r '$j=json_decode(stream_get_contents(STDIN), true); echo $j["access_token"] ?? "";')
TOKEN_RESPONSE=
if [[ -z "$ACCESS_TOKEN" ]]; then echo 'No se pudo obtener identidad de la VM.' >&2; exit 1; fi

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
  object="postgresql/${database}/${STAMP}.dump.enc"
  curl -fsS --retry 3 -X POST \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H 'Content-Type: application/octet-stream' \
    --data-binary "@$TMP/$database.dump.enc" \
    "https://storage.googleapis.com/upload/storage/v1/b/${BACKUP_BUCKET}/o?uploadType=media&name=${object}" \
    >/dev/null
done
ACCESS_TOKEN=
