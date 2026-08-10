# Produccion

## Infraestructura inicial

```powershell
./infra/gcp/bootstrap.ps1 `
  -ProjectId PROJECT_ID `
  -BackupBucketName BACKUP_BUCKET

./infra/gcp/initialize-secrets.ps1 `
  -ProjectId PROJECT_ID `
  -SourceEnvPath apps/api/.env

./infra/gcp/setup-github-oidc.ps1 -ProjectId PROJECT_ID
```

El bootstrap crea solo las identidades de VM/despliegue, los secretos `fal-key` y `backup-encryption-key`, y un bucket privado con retencion para backups. No existe almacenamiento de medios en Google.

## Primera configuracion de VM

Ejecuta `infra/scripts/provision-vm.sh` una vez. Luego configura el entorno:

```bash
sudo PROJECT_ID=PROJECT_ID \
  BACKUP_BUCKET=BACKUP_BUCKET \
  APP_URL=https://alturagrafica.mavdev.cloud \
  /usr/local/sbin/altura-configure-production
```

La cuenta `shared-vm-runtime` necesita `secretAccessor` sobre ambos secretos y `storage.objectAdmin` solamente sobre el bucket de backups.

## Despliegue

El workflow `Deploy production` instala y prueba dependencias, compila la PWA, crea un release inmutable y lo envia por IAP a la VM. El script remoto sincroniza `FAL_KEY` desde Secret Manager antes de cachear Laravel, migra PostgreSQL, cambia el enlace atomico y revierte si falla `/up`.

Variables del environment `production`: `GCP_PROJECT_ID`, `GCP_WIF_PROVIDER`, `GCP_DEPLOY_SERVICE_ACCOUNT`, `VM_NAME`, `VM_ZONE`, `APP_URL` y la configuracion publica de Firebase usada por Vite.

## Operacion

- Comprueba `systemctl status altura-worker altura-scheduler.timer altura-backup.timer`.
- Comprueba el ultimo backup cifrado y prueba una restauracion periodicamente.
- Rota FAL con `infra/gcp/set-fal-key.ps1`; el siguiente despliegue sincroniza la version nueva.
- Revisa creditos, errores de trabajos y antiguedad del secreto desde el panel administrativo.
