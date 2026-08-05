# Operación de producción

Este despliegue está diseñado para convivir con Gigantografías en la misma VM
sin duplicar servicios base y sin guardar credenciales en Git.

## 1. Preparar GCP

Desde la raíz del repositorio:

```powershell
./infra/gcp/bootstrap.ps1 `
  -ProjectId PROJECT_ID `
  -MediaBucketName MEDIA_BUCKET `
  -BackupBucketName BACKUP_BUCKET `
  -FirebaseProjectId FIREBASE_PROJECT_ID
```

El script habilita únicamente las APIs necesarias, crea los dos buckets
privados, Artifact Registry, Cloud Tasks, cinco cuentas de servicio con permisos
acotados y los recursos de Secret Manager. Después añada una versión a
`fal-key`, `image-internal-key` e `image-callback-secret` usando entrada estándar
o `infra/gcp/set-fal-key.ps1`; nunca incluya valores en argumentos o commits.

Configure la federación exacta del repositorio, sin claves persistentes:

```powershell
./infra/gcp/setup-github-oidc.ps1 `
  -ProjectId PROJECT_ID `
  -GitHubRepository MavDevGit/alturagraficaia
```

Guarde su salida y los valores Firebase públicos como variables del environment
`production` de GitHub. El workflow inicial es manual para permitir preparar
Cloud Run antes de modificar la VM.

## 2. Desplegar Cloud Run

Ejecute el workflow **Deploy production** con `target=cloud-run`. Este compila,
prueba y publica una imagen inmutable, despliega `altura-image-worker` privado y
`altura-image-webhook` público, y configura OIDC de Cloud Tasks. La API Laravel
debe usar la URL del worker tanto en `IMAGE_SERVICE_URL` como en
`IMAGE_SERVICE_AUDIENCE`; la clave interna sigue siendo una segunda defensa.

## 3. Preparar la VM compartida

Antes de cambiarla, confirme que Caddy, PostgreSQL, el túnel y Gigantografías
están saludables. Copie solamente `infra/` y ejecute como root:

```bash
bash infra/scripts/provision-vm.sh
read -rsp 'Contraseña PostgreSQL: ' ALTURA_DB_PASSWORD
export ALTURA_DB_PASSWORD
/usr/local/sbin/altura-init-postgres
unset ALTURA_DB_PASSWORD
```

El provisionador añade PHP 8.3, un pool con un solo hijo y límite de memoria, un
fragmento Caddy en `127.0.0.1:8082`, unidades systemd y scripts de despliegue y
backup. No altera el pool PHP, Caddy virtual host ni base de datos existentes de
Gigantografías.

Cree `/var/www/alturagrafica/shared/.env` a partir de
`apps/api/.env.production.example`, con propietario `root:altura` y modo `0640`.
Use secretos aleatorios distintos, la URL real y la cuenta de servicio adjunta a
la VM; no descargue credenciales JSON. Configure `/etc/altura/backup.env` y una
clave aleatoria en `/etc/altura/backup.key` con modo `0600`, conservando una copia
fuera de la VM.

## 4. Primer release y tráfico

Ejecute nuevamente **Deploy production** con `target=all`. El workflow entrega
el paquete por IAP, valida SHA-256, hace backup previo a migraciones, cambia el
symlink de forma atómica, comprueba `/up` y revierte si falla. Después habilite:

```bash
systemctl enable --now altura-worker altura-scheduler.timer altura-backup.timer
```

Solo cuando `curl http://127.0.0.1:8082/up` y el sitio existente estén sanos,
añada al túnel compartido la ruta:

```text
alturagrafica.mavdev.cloud → http://127.0.0.1:8082
```

Elimine la ruta del túnel local únicamente después de validar HTTPS, login y un
trabajo completo. Configure `alturagrafica.mavdev.cloud` como dominio autorizado
en Firebase Authentication.

## 5. Verificación obligatoria

```bash
curl --fail http://127.0.0.1:8082/up
sudo -u altura php8.3 /var/www/alturagrafica/current/apps/api/artisan about
systemctl --no-pager --full status caddy php8.3-fpm postgresql \
  altura-worker altura-scheduler.timer altura-backup.timer cloudflared
```

Además, valide login por correo y Google, rechazo de `/admin` a usuarios
normales, un procesamiento real, devolución de créditos ante fallo, descarga y
mosaicos por URL firmada, backup cifrado y restauración en una base aislada.
Compruebe métricas de memoria/swap, almacenamiento y cuotas tras la primera carga.

## Controles de lanzamiento

- Alertas de presupuesto y canales de Monitoring activos.
- Firebase: dominios autorizados y proveedores de login verificados.
- FAL: clave rotada, webhook real y saldo/coste entendido.
- GitHub: protección de `main`, revisión de Dependabot y environment protegido.
- GCP: VM sin IP pública, firewall web cerrado y cuentas sin roles amplios.
