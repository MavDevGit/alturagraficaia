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

fetch_secret() {
  local name=$1 response
  response=$(curl -fsS --retry 3 -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://secretmanager.googleapis.com/v1/projects/${PROJECT_ID}/secrets/${name}/versions/latest:access")
  printf '%s' "$response" | php8.3 -r '$j=json_decode(stream_get_contents(STDIN), true); echo base64_decode($j["payload"]["data"] ?? "", true) ?: "";'
}

FAL_PROXY_HMAC_SECRET=$(fetch_secret fal-proxy-hmac-secret)
FAL_PROXY_URL=$(fetch_secret fal-proxy-url)
ACCESS_TOKEN=
if [[ ${#FAL_PROXY_HMAC_SECRET} -lt 32 || "$FAL_PROXY_HMAC_SECRET" =~ [[:space:]#] ]]; then
  echo 'Secret Manager no devolvio un secreto HMAC valido.' >&2
  exit 1
fi
if [[ ! "$FAL_PROXY_URL" =~ ^https://[A-Za-z0-9.-]+/?$ ]]; then
  echo 'Secret Manager no devolvio una URL HTTPS valida para el proxy FAL.' >&2
  exit 1
fi

TEMP=$(mktemp /etc/altura/runtime-env.XXXXXX)
cleanup() {
  [[ "$TEMP" == /etc/altura/runtime-env.* ]] && rm -f -- "$TEMP"
  FAL_PROXY_HMAC_SECRET=
  FAL_PROXY_URL=
}
trap cleanup EXIT

grep -E '^(APP_.*|LOG_.*|DB_.*|SESSION_.*|ASSET_.*|MAX_.*|IMAGE_JOBS_.*|CACHE_STORE|QUEUE_CONNECTION|AUTH_DRIVER|FIREBASE_PROJECT_ID|FIREBASE_AUTH_EMULATOR_HOST|INITIAL_CREDITS|JOB_STALE_MINUTES|CORS_ALLOWED_ORIGINS|FAL_KEY_ROTATED_AT|FAL_PROXY_ROTATED_AT)=' "$ENV_FILE" > "$TEMP"

append_if_missing() {
  local name=$1 value=$2
  if ! grep -q "^${name}=" "$TEMP"; then
    printf '%s=%s\n' "$name" "$value" >> "$TEMP"
  fi
}

CURRENT_CONFIG=/var/www/alturagrafica/current/apps/api/bootstrap/cache/config.php
config_value() {
  local path=$1
  CURRENT_CONFIG="$CURRENT_CONFIG" php8.3 -r '
    $file = getenv("CURRENT_CONFIG");
    if (!$file || !is_file($file)) { exit(1); }
    $value = require $file;
    foreach (explode(".", $argv[1]) as $key) {
        if (!is_array($value) || !array_key_exists($key, $value)) { exit(1); }
        $value = $value[$key];
    }
    if (!is_scalar($value)) { exit(1); }
    echo $value;
  ' "$path"
}

if ! grep -q '^APP_KEY=' "$TEMP"; then
  APP_KEY_RECOVERED=$(config_value app.key)
  APP_URL_RECOVERED=$(config_value app.url)
  DB_PASSWORD_RECOVERED=$(config_value database.connections.pgsql.password)
  if [[ "$APP_KEY_RECOVERED" != base64:* || "$APP_URL_RECOVERED" != https://* || -z "$DB_PASSWORD_RECOVERED" ]]; then
    echo 'No se pudo recuperar el entorno anterior desde el cache vigente.' >&2
    exit 1
  fi
  append_if_missing APP_NAME '"Altura Grafica IA"'
  append_if_missing APP_ENV production
  append_if_missing APP_KEY "$APP_KEY_RECOVERED"
  append_if_missing APP_DEBUG false
  append_if_missing APP_URL "$APP_URL_RECOVERED"
  append_if_missing APP_LOCALE es
  append_if_missing APP_FALLBACK_LOCALE es
  append_if_missing LOG_CHANNEL stack
  append_if_missing LOG_STACK daily
  append_if_missing LOG_LEVEL warning
  append_if_missing LOG_DAILY_DAYS 7
  append_if_missing DB_CONNECTION pgsql
  append_if_missing DB_HOST "$(config_value database.connections.pgsql.host)"
  append_if_missing DB_PORT "$(config_value database.connections.pgsql.port)"
  append_if_missing DB_DATABASE "$(config_value database.connections.pgsql.database)"
  append_if_missing DB_USERNAME "$(config_value database.connections.pgsql.username)"
  append_if_missing DB_PASSWORD "$DB_PASSWORD_RECOVERED"
  append_if_missing SESSION_DRIVER database
  append_if_missing SESSION_SECURE_COOKIE true
  append_if_missing SESSION_SAME_SITE lax
  append_if_missing DB_QUEUE_TABLE queue_jobs
  append_if_missing ASSET_THUMBNAIL_TOKEN_TTL 900
  append_if_missing DB_QUEUE_RETRY_AFTER 1000
  append_if_missing ASSET_TTL_DAYS 7
  append_if_missing ASSET_VIEWER_TOKEN_TTL 14400
  append_if_missing INITIAL_CREDITS 20
  append_if_missing MAX_UPLOAD_KB 51200
  append_if_missing MAX_INPUT_SIDE 20000
  append_if_missing MAX_INPUT_PIXELS 100000000
  append_if_missing MAX_OUTPUT_SIDE 32768
  append_if_missing MAX_OUTPUT_PIXELS 400000000
  append_if_missing IMAGE_JOBS_SOFT_LIMIT 80
  append_if_missing IMAGE_JOBS_HARD_LIMIT 100
  append_if_missing JOB_STALE_MINUTES 720
  append_if_missing CORS_ALLOWED_ORIGINS "$APP_URL_RECOVERED"
fi
printf 'FILESYSTEM_DISK=local\nFAL_KEY=\nFAL_PROXY_URL=%s\nFAL_PROXY_HMAC_SECRET=%s\nFAL_KEY_CONFIGURED=true\n' \
  "$FAL_PROXY_URL" "$FAL_PROXY_HMAC_SECRET" >> "$TEMP"
install -o root -g altura -m 0640 "$TEMP" "$ENV_FILE"

echo 'Entorno de runtime sincronizado con Secret Manager.'
