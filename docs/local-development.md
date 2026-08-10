# Desarrollo local

1. Copia `.env.example` a `.env` en `apps/api` y `apps/web`.
2. Prepara PostgreSQL con `scripts/create-databases.ps1`.
3. Ejecuta `npm run setup`.
4. Ejecuta `npm run fal:local:configure` y pega la clave de forma oculta.
5. Inicia los cuatro procesos con `npm run dev`.

La PWA usa `http://127.0.0.1:5173`, Laravel `http://127.0.0.1:8000`, Firebase Auth Emulator el puerto `9099` y su UI el `4000`. Para recibir el webhook real, `APP_URL` debe apuntar a una URL HTTPS publica que reenvie `/api` a Laravel.

La carga del archivo sale directamente desde el navegador hacia la URL firmada de FAL. Las pruebas automatizadas simulan tanto esa carga como los webhooks y no consumen creditos FAL.
