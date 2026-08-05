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
if [[ ! -f "$SHARED_ROOT/.env" ]]; then
  echo "Falta $SHARED_ROOT/.env." >&2
  exit 1
fi
echo "$EXPECTED_SHA  $ARCHIVE" | sha256sum --check --status || { echo "Checksum inválido." >&2; exit 1; }

install -d -o altura -g caddy -m 0750 "$TARGET"
tar -xzf "$ARCHIVE" -C "$TARGET"
if [[ ! -f "$TARGET/apps/api/artisan" || ! -f "$TARGET/apps/web/dist/index.html" || ! -f "$TARGET/apps/api/vendor/autoload.php" ]]; then
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

cd "$TARGET/apps/api"
runuser -u altura -- /usr/bin/php8.3 artisan config:cache
runuser -u altura -- /usr/bin/php8.3 artisan route:cache
runuser -u altura -- /usr/bin/php8.3 artisan view:cache

systemctl start altura-backup.service
runuser -u altura -- /usr/bin/php8.3 artisan migrate --force

rm -f -- "$CURRENT_LINK.new" "$CURRENT_LINK.rollback"
ln -s "$TARGET" "$CURRENT_LINK.new"
mv -Tf "$CURRENT_LINK.new" "$CURRENT_LINK"
systemctl reload php8.3-fpm
systemctl restart altura-worker.service

if ! curl -fsS --max-time 20 http://127.0.0.1:8082/up >/dev/null; then
  if [[ -n "$PREVIOUS" && "$PREVIOUS" == "$RELEASE_ROOT"/* && -d "$PREVIOUS" ]]; then
    ln -s "$PREVIOUS" "$CURRENT_LINK.rollback"
    mv -Tf "$CURRENT_LINK.rollback" "$CURRENT_LINK"
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

echo "Release $RELEASE_ID activo y saludable."
