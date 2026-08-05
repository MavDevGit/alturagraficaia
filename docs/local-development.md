# Desarrollo local en Windows

Requisitos: Node 22, PHP 8.3 o superior con `pdo_pgsql`, PostgreSQL 16, Java 21, Composer, Firebase CLI y Google Cloud CLI. Docker Desktop no se usa.

1. Copie `.env.example` a `.env` en `apps/api`, `apps/web` y `apps/image-service`.
2. Ejecute `powershell -File scripts/create-databases.ps1`; el script crea el rol `alturagrafica` y las bases `alturagrafica_pwa` y `alturagrafica_pwa_test` sin alterar otras bases de la instancia.
3. Ejecute `composer install` y `php artisan key:generate` en `apps/api`.
4. Ejecute `npm run setup` desde la raíz y `php apps/api/artisan migrate --seed`.
5. Ejecute `npm run dev`.

Para mantener disponibles desarrollo y produccion local en paralelo, ejecute `npm run local:start`. La API, el worker, Image Service y Firebase Emulator son compartidos por ambos frontends. Use `npm run local:status` para verificar el entorno y `npm run local:stop` para cerrarlo.

Para consumir FAL real desde esta PC mediante Cloudflare Tunnel, siga
[`local-fal.md`](local-fal.md). La configuracion predeterminada continua usando
el proveedor simulado y no consume saldo externo.

`npm test` usa SQLite en memoria para una comprobación rápida y aislada. `npm run test:api:postgres` ejecuta la misma suite contra `alturagrafica_pwa_test`; CI siempre utiliza PostgreSQL 16.

Puertos: web de desarrollo `5173`, web de produccion local `4173`, API `8000`, Image Service `8787`, PostgreSQL `5432`, Firebase Auth Emulator `9099` y Emulator UI `4000`.

Todos los servidores HTTP locales escuchan solamente en loopback. Cloudflare Tunnel puede conectarse a esos origenes desde la misma PC sin abrirlos a la red LAN. Antes de publicar un hostname se deben definir el dominio, las rutas publicas y la URL publica del emulador de autenticacion; no exponga el Emulator UI.

Para el proveedor falso, `LOCAL_STORAGE_PATH=../api/storage/app/private` permite que Laravel y Sharp compartan objetos sin GCS. Para probar Firebase real o GCS/FAL, cambie solamente variables privadas no versionadas.
