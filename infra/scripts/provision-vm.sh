#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then echo "Ejecute como root." >&2; exit 1; fi
if ! systemctl is-active --quiet caddy || ! systemctl is-active --quiet postgresql; then
  echo "La VM compartida debe tener Caddy y PostgreSQL activos antes de continuar." >&2
  exit 1
fi

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ca-certificates curl unzip rsync \
  php8.3-cli php8.3-fpm php8.3-pgsql php8.3-curl php8.3-mbstring \
  php8.3-intl php8.3-xml php8.3-zip php8.3-bcmath

if ! id altura >/dev/null 2>&1; then
  useradd --system --home-dir /var/www/alturagrafica/shared --shell /usr/sbin/nologin altura
fi

install -d -o altura -g caddy -m 0750 /var/www/alturagrafica/releases
install -d -o altura -g altura -m 0750 /var/www/alturagrafica/shared
install -d -o root -g altura -m 0750 /etc/altura
install -d -o caddy -g caddy -m 0750 /etc/caddy/conf.d

install -m 0644 infra/php/99-altura.ini /etc/php/8.3/fpm/conf.d/99-altura.ini
install -m 0644 infra/php/altura-fpm.conf /etc/php/8.3/fpm/pool.d/altura.conf
if [[ -f /etc/php/8.3/fpm/pool.d/www.conf ]]; then
  mv /etc/php/8.3/fpm/pool.d/www.conf /etc/php/8.3/fpm/pool.d/www.conf.disabled
fi
install -m 0644 infra/caddy/alturagrafica.caddy /etc/caddy/conf.d/alturagrafica.caddy
if ! grep -Fq 'import /etc/caddy/conf.d/*.caddy' /etc/caddy/Caddyfile; then
  printf '\n# Aplicaciones adicionales en loopback\nimport /etc/caddy/conf.d/*.caddy\n' >> /etc/caddy/Caddyfile
fi

install -m 0644 infra/systemd/altura-worker.service /etc/systemd/system/
install -m 0644 infra/systemd/altura-scheduler.service /etc/systemd/system/
install -m 0644 infra/systemd/altura-scheduler.timer /etc/systemd/system/
install -m 0644 infra/systemd/altura-backup.service /etc/systemd/system/
install -m 0644 infra/systemd/altura-backup.timer /etc/systemd/system/
install -m 0750 infra/scripts/backup-postgres.sh /usr/local/sbin/altura-backup-postgres
install -m 0750 infra/scripts/init-postgres.sh /usr/local/sbin/altura-init-postgres
install -m 0750 infra/scripts/configure-production.sh /usr/local/sbin/altura-configure-production
install -m 0750 infra/scripts/deploy.sh /usr/local/sbin/altura-deploy

php-fpm8.3 -t
caddy validate --config /etc/caddy/Caddyfile
systemctl daemon-reload
systemctl enable php8.3-fpm altura-scheduler.timer
systemctl restart php8.3-fpm
systemctl reload caddy

echo "Runtime compartido preparado. Configure secretos, base de datos y primer release antes de activar worker y backups."
