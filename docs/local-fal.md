# FAL local

Ejecuta `npm run fal:local:configure` y pega la clave cuando PowerShell la solicite. El script escribe `FAL_KEY` solamente en `apps/api/.env`, marca el estado administrativo y nunca imprime el secreto.

Para una prueba completa, publica Laravel mediante el tunel HTTPS configurado y establece `APP_URL` con ese origen. Laravel construye el webhook `/api/internal/fal-webhook`; FAL lo invoca directamente y la firma se valida antes de tocar el trabajo o los creditos.

Original y resultado usan el ciclo de vida FAL de siete dias. La PWA carga y descarga los archivos completos de forma directa.
