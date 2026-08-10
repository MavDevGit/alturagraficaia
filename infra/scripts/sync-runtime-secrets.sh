#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then echo 'Ejecute como root.' >&2; exit 1; fi

ENV_FILE=/var/www/alturagrafica/shared/.env
if [[ ! -f "$ENV_FILE" ]]; then echo "Falta $ENV_FILE." >&2; exit 1; fi

PROJECT_ID=$(curl -fsS --retry 3 -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/project/project-id')
TOKEN_RESPONSE=$(curl -fsS --retry 3 -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token')
ACCESS_TOKEN=$(printf '%s' "$TOKEN_RESPONSE" | php8.3 -r '$j=json_decode(stream_get_contents(STDIN), true); echo $j["access_token"] ?? "";')
TOKEN_RESPONSE=
if [[ -z "$PROJECT_ID" || -z "$ACCESS_TOKEN" ]]; then echo 'No se pudo obtener identidad de la VM.' >&2; exit 1; fi

RESPONSE=$(curl -fsS --retry 3 -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/fal-key/versions/latest:access")
FAL_KEY=$(printf '%s' "$RESPONSE" | php8.3 -r '$j=json_decode(stream_get_contents(STDIN), true); echo base64_decode($j["payload"]["data"] ?? "", true) ?: "";')
RESPONSE=
ACCESS_TOKEN=
if [[ ${#FAL_KEY} -lt 16 || "$FAL_KEY" =~ [[:space:]#] ]]; then
  echo 'Secret Manager no devolvio una FAL_KEY valida.' >&2
  exit 1
fi

TEMP=$(mktemp /etc/altura/runtime-env.XXXXXX)
cleanup() {
  [[ "$TEMP" == /etc/altura/runtime-env.* ]] && rm -f -- "$TEMP"
  FAL_KEY=
}
trap cleanup EXIT

grep -E '^(APP_|LOG_|DB_|SESSION_|CACHE_STORE|QUEUE_CONNECTION|AUTH_DRIVER|FIREBASE_PROJECT_ID|FIREBASE_AUTH_EMULATOR_HOST|ASSET_|INITIAL_CREDITS|MAX_|IMAGE_JOBS_|JOB_STALE_MINUTES|CORS_ALLOWED_ORIGINS|FAL_KEY_ROTATED_AT)=' "$ENV_FILE" > "$TEMP"
printf 'FILESYSTEM_DISK=local\nFAL_KEY=%s\nFAL_KEY_CONFIGURED=true\n' "$FAL_KEY" >> "$TEMP"
install -o root -g altura -m 0640 "$TEMP" "$ENV_FILE"

echo 'Entorno de runtime sincronizado con Secret Manager.'
