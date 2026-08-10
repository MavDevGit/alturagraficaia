# Altura Grafica IA PWA

Aplicacion web progresiva para ampliar imagenes, quitar fondos y extender lienzos con IA. La PWA React carga cada archivo directamente al CDN de FAL; Laravel administra autenticacion, creditos, trabajos, webhooks e historial en PostgreSQL sin transportar los bytes de las imagenes.

## Requisitos locales

- PHP 8.3 o superior con `curl`, `intl`, `mbstring`, `openssl`, `pdo_pgsql`, `pgsql`, `sodium` y `zip`.
- Composer 2, Node.js 22 y npm.
- PostgreSQL 16 en `localhost:5432`.
- Firebase CLI y Java 21 para el emulador de autenticacion.
- Una `FAL_KEY` para procesar imagenes reales.

## Inicio rapido

1. Crea el rol y las bases con `powershell -File scripts/create-databases.ps1`.
2. Ejecuta `npm run setup`.
3. Guarda la clave con `npm run fal:local:configure`.
4. Ejecuta `npm run dev` para iniciar React, Laravel, el worker de cola y Firebase Auth Emulator.

`npm run local:start` deja desarrollo y la compilacion local de produccion en segundo plano. Usa `npm run local:status` para comprobarlos y `npm run local:stop` para detenerlos.

## Comandos principales

- `npm run contracts`: regenera los tipos TypeScript desde OpenAPI.
- `npm run lint`: valida la PWA.
- `npm test`: ejecuta Vitest y Pest.
- `npm run test:e2e`: ejecuta Playwright.
- `npm run build`: compila la PWA.

Produccion usa una VM compartida con Caddy, PHP-FPM, PostgreSQL y el worker Laravel. Las imagenes permanecen en FAL durante siete dias. Google Cloud Storage se usa exclusivamente para backups cifrados de PostgreSQL; no almacena originales ni resultados.

La clave de produccion se carga o rota con `powershell -File infra/gcp/set-fal-key.ps1 -ProjectId PROJECT_ID` y se inyecta desde Secret Manager. Consulta [docs/architecture.md](docs/architecture.md), [docs/local-development.md](docs/local-development.md) y [docs/production-readiness.md](docs/production-readiness.md).
