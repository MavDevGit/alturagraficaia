#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then echo "Ejecute como root." >&2; exit 1; fi
if [[ $# -ne 3 ]]; then echo "Uso: deploy.sh ARCHIVE RELEASE_ID SHA256" >&2; exit 1; fi

ARCHIVE=$(realpath "$1")
RELEASE_ID=$2
EXPECTED_SHA=$3
RELEASE_ROOT=/var/www/alturagrafica/releases
SHARED_ROOT=/var/www/alturagrafica/shared
CURRENT_LINK=/var/www/alturagrafica/current
TARGET="$RELEASE_ROOT/$RELEASE_ID"
PREVIOUS=$(readlink -f "$CURRENT_LINK" 2>/dev/null || true)
ENV_FILE="$SHARED_ROOT/.env"
ENV_BACKUP=
ENV_MUTATED=0
CURRENT_MUTATED=0
CADDY_CONFIG=/etc/caddy/conf.d/alturagrafica.caddy
CADDY_BACKUP=
CADDY_MUTATED=0
DEPLOY_SUCCEEDED=0

finish_deploy() {
  local exit_code=$?
  trap - EXIT
  if [[ $exit_code -ne 0 && $DEPLOY_SUCCEEDED -eq 0 ]]; then
    if [[ $ENV_MUTATED -eq 1 && -n "$ENV_BACKUP" && -f "$ENV_BACKUP" ]]; then
      install -o root -g altura -m 0640 "$ENV_BACKUP" "$ENV_FILE"
    fi
    if [[ $CADDY_MUTATED -eq 1 && -n "$CADDY_BACKUP" && -f "$CADDY_BACKUP" ]]; then
      install -o root -g root -m 0644 "$CADDY_BACKUP" "$CADDY_CONFIG"
      systemctl reload caddy || true
    fi
    if [[ $CURRENT_MUTATED -eq 1 && -n "$PREVIOUS" && "$PREVIOUS" == "$RELEASE_ROOT"/* && -d "$PREVIOUS" ]]; then
      rm -f -- "$CURRENT_LINK.rollback"
      ln -s "$PREVIOUS" "$CURRENT_LINK.rollback"
      mv -Tf "$CURRENT_LINK.rollback" "$CURRENT_LINK"
      if [[ -f "$PREVIOUS/apps/api/artisan" ]]; then
        (cd "$PREVIOUS/apps/api" && runuser -u altura -- /usr/bin/php8.3 artisan config:cache) || true
      fi
      systemctl reload php8.3-fpm || true
      systemctl restart altura-worker.service || true
    fi
  fi
  if [[ -n "$ENV_BACKUP" && "$ENV_BACKUP" == /tmp/altura-env.* && -f "$ENV_BACKUP" ]]; then
    local backup_size
    backup_size=$(stat -c '%s' "$ENV_BACKUP" 2>/dev/null || printf '0')
    if [[ "$backup_size" =~ ^[0-9]+$ && $backup_size -gt 0 ]]; then
      dd if=/dev/zero of="$ENV_BACKUP" bs="$backup_size" count=1 conv=notrunc status=none || true
    fi
    rm -f -- "$ENV_BACKUP"
  fi
  if [[ -n "$CADDY_BACKUP" && "$CADDY_BACKUP" == /tmp/altura-caddy.* && -f "$CADDY_BACKUP" ]]; then
    rm -f -- "$CADDY_BACKUP"
  fi
  exit "$exit_code"
}
trap finish_deploy EXIT

if [[ ! "$RELEASE_ID" =~ ^[a-f0-9]{40}$ ]] || [[ ! -f "$ARCHIVE" ]]; then
  echo "Release o paquete inválido." >&2
  exit 1
fi
if [[ "$RELEASE_ROOT" != /var/www/alturagrafica/releases ]] || [[ "$TARGET" != "$RELEASE_ROOT"/* ]]; then
  echo "Ruta de release no permitida." >&2
  exit 1
fi
if [[ -e "$TARGET" ]]; then
  echo "El release $RELEASE_ID ya existe." >&2
  exit 1
fi
if [[ ! -f "$ENV_FILE" ]]; then
  echo "Falta $ENV_FILE." >&2
  exit 1
fi
echo "$EXPECTED_SHA  $ARCHIVE" | sha256sum --check --status || { echo "Checksum inválido." >&2; exit 1; }

install -d -o altura -g caddy -m 0750 "$TARGET"
tar -xzf "$ARCHIVE" -C "$TARGET"
if [[ ! -f "$TARGET/apps/api/artisan" || ! -f "$TARGET/apps/web/dist/index.html" || ! -f "$TARGET/apps/api/vendor/autoload.php" \
  || ! -f "$TARGET/infra/caddy/alturagrafica.caddy" || ! -f "$TARGET/infra/scripts/deploy.sh" \
  || ! -f "$TARGET/infra/scripts/sync-runtime-secrets.sh" ]]; then
  echo "El paquete no contiene los artefactos de producción." >&2
  exit 1
fi

install -d -o altura -g altura -m 0750 \
  "$SHARED_ROOT/storage/app/private" \
  "$SHARED_ROOT/storage/framework/cache/data" \
  "$SHARED_ROOT/storage/framework/sessions" \
  "$SHARED_ROOT/storage/framework/views" \
  "$SHARED_ROOT/storage/logs"
rm -rf -- "$TARGET/apps/api/storage"
ln -s "$SHARED_ROOT/storage" "$TARGET/apps/api/storage"
ln -s "$SHARED_ROOT/.env" "$TARGET/apps/api/.env"
chown -R altura:caddy "$TARGET"
chmod 0640 "$SHARED_ROOT/.env"

ENV_BACKUP=$(mktemp /tmp/altura-env.XXXXXX)
install -o root -g root -m 0600 "$ENV_FILE" "$ENV_BACKUP"
ENV_MUTATED=1
/bin/bash "$TARGET/infra/scripts/sync-runtime-secrets.sh"

cd "$TARGET/apps/api"
runuser -u altura -- /usr/bin/php8.3 artisan config:cache
runuser -u altura -- /usr/bin/php8.3 artisan route:cache
runuser -u altura -- /usr/bin/php8.3 artisan view:cache

systemctl start altura-backup.service
runuser -u altura -- /usr/bin/php8.3 artisan migrate --force

CADDY_BACKUP=$(mktemp /tmp/altura-caddy.XXXXXX)
cp -- "$CADDY_CONFIG" "$CADDY_BACKUP"
install -o root -g root -m 0644 "$TARGET/infra/caddy/alturagrafica.caddy" "$CADDY_CONFIG"
CADDY_MUTATED=1
if ! caddy validate --config /etc/caddy/Caddyfile; then
  install -o root -g root -m 0644 "$CADDY_BACKUP" "$CADDY_CONFIG"
  CADDY_MUTATED=0
  echo "La configuración de Caddy no es válida; se restauró la anterior." >&2
  exit 1
fi
systemctl reload caddy

rm -f -- "$CURRENT_LINK.new" "$CURRENT_LINK.rollback"
ln -s "$TARGET" "$CURRENT_LINK.new"
mv -Tf "$CURRENT_LINK.new" "$CURRENT_LINK"
CURRENT_MUTATED=1
systemctl reload php8.3-fpm
systemctl restart altura-worker.service
install -o root -g root -m 0750 "$TARGET/infra/scripts/deploy.sh" /usr/local/sbin/altura-deploy
install -o root -g root -m 0750 "$TARGET/infra/scripts/sync-runtime-secrets.sh" /usr/local/sbin/altura-sync-runtime-secrets

if ! curl -fsS --max-time 20 http://127.0.0.1:8082/up >/dev/null; then
  ENV_MUTATED=0
  install -o root -g altura -m 0640 "$ENV_BACKUP" "$ENV_FILE"
  CADDY_MUTATED=0
  install -o root -g root -m 0644 "$CADDY_BACKUP" "$CADDY_CONFIG"
  systemctl reload caddy
  if [[ -n "$PREVIOUS" && "$PREVIOUS" == "$RELEASE_ROOT"/* && -d "$PREVIOUS" ]]; then
    ln -s "$PREVIOUS" "$CURRENT_LINK.rollback"
    mv -Tf "$CURRENT_LINK.rollback" "$CURRENT_LINK"
    CURRENT_MUTATED=0
    (cd "$PREVIOUS/apps/api" && runuser -u altura -- /usr/bin/php8.3 artisan config:cache) || true
    systemctl reload php8.3-fpm
    systemctl restart altura-worker.service
  fi
  echo "El health check falló; se restauró el release anterior cuando fue posible." >&2
  exit 1
fi

find "$RELEASE_ROOT" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr | tail -n +4 | cut -d' ' -f2- \
  | while IFS= read -r old_release; do
      [[ "$old_release" == "$RELEASE_ROOT"/* ]] || exit 1
      rm -rf -- "$old_release"
    done

DEPLOY_SUCCEEDED=1
echo "Release $RELEASE_ID activo y saludable."
