#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then echo 'Ejecute como root.' >&2; exit 1; fi
: "${PROJECT_ID:?PROJECT_ID es obligatorio}"
: "${MEDIA_BUCKET:?MEDIA_BUCKET es obligatorio}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET es obligatorio}"
: "${APP_URL:?APP_URL es obligatorio}"
: "${IMAGE_SERVICE_URL:?IMAGE_SERVICE_URL es obligatorio}"
if [[ "$APP_URL" != https://* || "$IMAGE_SERVICE_URL" != https://* ]]; then
  echo 'Las URLs de producción deben usar HTTPS.' >&2
  exit 1
fi

SHARED_ROOT=/var/www/alturagrafica/shared
ENV_FILE="$SHARED_ROOT/.env"
if [[ -e "$ENV_FILE" ]]; then
  echo "$ENV_FILE ya existe; no se sobrescribirá una instalación activa." >&2
  exit 1
fi

TOKEN_RESPONSE=$(curl -fsS --retry 3 -H 'Metadata-Flavor: Google' \
  'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token')
ACCESS_TOKEN=$(printf '%s' "$TOKEN_RESPONSE" | php8.3 -r '$j=json_decode(stream_get_contents(STDIN), true); echo $j["access_token"] ?? "";')
TOKEN_RESPONSE=
if [[ -z "$ACCESS_TOKEN" ]]; then echo 'No se pudo obtener identidad de la VM.' >&2; exit 1; fi

fetch_secret() {
  local name=$1 response
  response=$(curl -fsS --retry 3 -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${name}/versions/latest:access")
  printf '%s' "$response" | php8.3 -r '$j=json_decode(stream_get_contents(STDIN), true); echo base64_decode($j["payload"]["data"] ?? "", true) ?: "";'
}

INTERNAL_KEY=$(fetch_secret image-internal-key)
CALLBACK_SECRET=$(fetch_secret image-callback-secret)
BACKUP_KEY=$(fetch_secret backup-encryption-key)
if [[ ${#INTERNAL_KEY} -lt 32 || ${#CALLBACK_SECRET} -lt 32 || ${#BACKUP_KEY} -lt 32 ]]; then
  echo 'Secret Manager no devolvió secretos de producción válidos.' >&2
  exit 1
fi

DB_PASSWORD=$(openssl rand -base64 48 | tr '+/' '-_' | tr -d '=\n')
APP_KEY="base64:$(openssl rand -base64 32 | tr -d '\n')"
export ALTURA_DB_PASSWORD=$DB_PASSWORD
/usr/local/sbin/altura-init-postgres
unset ALTURA_DB_PASSWORD

install -d -o altura -g altura -m 0750 "$SHARED_ROOT"
umask 077
ENV_TEMP=$(mktemp /etc/altura/app-env.XXXXXX)
BACKUP_TEMP=$(mktemp /etc/altura/backup-env.XXXXXX)
cleanup() {
  [[ "$ENV_TEMP" == /etc/altura/app-env.* ]] && rm -f -- "$ENV_TEMP"
  [[ "$BACKUP_TEMP" == /etc/altura/backup-env.* ]] && rm -f -- "$BACKUP_TEMP"
}
trap cleanup EXIT

cat >"$ENV_TEMP" <<EOF
APP_NAME="Altura Gráfica IA"
APP_ENV=production
APP_KEY=$APP_KEY
APP_DEBUG=false
APP_URL=$APP_URL
APP_LOCALE=es
APP_FALLBACK_LOCALE=es
LOG_CHANNEL=stack
LOG_STACK=daily
LOG_LEVEL=warning
LOG_DAILY_DAYS=7
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=alturagrafica_pwa
DB_USERNAME=alturagrafica
DB_PASSWORD=$DB_PASSWORD
SESSION_DRIVER=database
SESSION_SECURE_COOKIE=true
SESSION_SAME_SITE=lax
CACHE_STORE=database
QUEUE_CONNECTION=database
DB_QUEUE_TABLE=queue_jobs
DB_QUEUE_RETRY_AFTER=1000
AUTH_DRIVER=firebase
FIREBASE_PROJECT_ID=altura-grafica-ia
FIREBASE_CREDENTIALS=
FIREBASE_AUTH_EMULATOR_HOST=
FILESYSTEM_DISK=gcs
GCP_PROJECT_ID=$PROJECT_ID
GCS_BUCKET=$MEDIA_BUCKET
GOOGLE_APPLICATION_CREDENTIALS=
IMAGE_SERVICE_URL=$IMAGE_SERVICE_URL
IMAGE_SERVICE_AUDIENCE=$IMAGE_SERVICE_URL
IMAGE_SERVICE_KEY=$INTERNAL_KEY
IMAGE_CALLBACK_SECRET=$CALLBACK_SECRET
ASSET_TTL_DAYS=7
ASSET_VIEWER_TOKEN_TTL=14400
INITIAL_CREDITS=20
MAX_UPLOAD_KB=51200
MAX_INPUT_SIDE=20000
MAX_INPUT_PIXELS=100000000
MAX_OUTPUT_SIDE=32768
MAX_OUTPUT_PIXELS=400000000
STORAGE_SOFT_LIMIT_BYTES=3758096384
STORAGE_HARD_LIMIT_BYTES=4294967296
IMAGE_JOBS_SOFT_LIMIT=80
IMAGE_JOBS_HARD_LIMIT=100
GCS_CLASS_A_SOFT_LIMIT=4200
GCS_CLASS_A_HARD_LIMIT=4700
JOB_STALE_MINUTES=720
CORS_ALLOWED_ORIGINS=$APP_URL
FAL_KEY_CONFIGURED=true
FAL_KEY_ROTATED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF
install -o root -g altura -m 0640 "$ENV_TEMP" "$ENV_FILE"

if [[ ! -e /etc/altura/backup.key ]]; then
  printf '%s' "$BACKUP_KEY" > /etc/altura/backup.key
  chmod 0600 /etc/altura/backup.key
fi
cat >"$BACKUP_TEMP" <<EOF
BACKUP_BUCKET=$BACKUP_BUCKET
BACKUP_ENCRYPTION_KEY_FILE=/etc/altura/backup.key
BACKUP_DATABASES="gigantografia_prod alturagrafica_pwa"
EOF
install -o root -g root -m 0600 "$BACKUP_TEMP" /etc/altura/backup.env

ACCESS_TOKEN=
INTERNAL_KEY=
CALLBACK_SECRET=
BACKUP_KEY=
DB_PASSWORD=
APP_KEY=
echo 'Base, entorno y backup de Altura configurados sin exponer secretos.'
