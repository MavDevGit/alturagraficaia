# Altura Gráfica IA PWA

Aplicación web progresiva para ampliar imágenes, quitar fondos y extender lienzos con IA. Contiene una SPA React/MUI, una API Laravel y dos modos del servicio de imágenes para Cloud Run: webhook liviano y worker privado.

## Requisitos locales

- PHP 8.3 o superior con `curl`, `intl`, `mbstring`, `openssl`, `pdo_pgsql`, `pgsql` y `zip`.
- Composer 2.
- Node.js 22 y npm.
- PostgreSQL 16 ejecutándose en `localhost:5432`.
- Firebase CLI y Java 21 para el emulador de autenticación.

## Inicio rápido

1. Crea el rol y las bases locales con `powershell -File scripts/create-databases.ps1`. El script solicita de forma segura la contraseña del administrador `postgres` existente.
2. Ejecuta `npm run setup`; copia entornos faltantes, instala dependencias, genera el contrato, migra PostgreSQL y compila.
3. Ejecuta `npm run dev` para iniciar React (`5173`), Laravel (`8000`), el worker, Image Service (`8787`) y Firebase Auth Emulator (`9099`).

Para trabajar con desarrollo y la compilacion de produccion local al mismo tiempo, usa `npm run local:start`. El comando compila y deja ambos frontends en segundo plano: desarrollo con recarga en `http://127.0.0.1:5173` y produccion local en `http://127.0.0.1:4173`. Comprueba los procesos con `npm run local:status` y detenlos con `npm run local:stop`. Los registros quedan en `storage/runtime/`.

Si prefieres automatizar el primer paso, define temporalmente `ALTURA_PG_ADMIN_PASSWORD` antes de `npm run setup`. La variable no se guarda en el repositorio.

Por defecto, los archivos se guardan en disco local y el servicio de imágenes usa un proveedor FAL simulado. Ninguna clave real es necesaria para desarrollar la interfaz y el flujo de trabajos.

## Comandos raíz

- `npm run setup`: preparación reproducible de desarrollo.
- `npm run dev`: cinco procesos locales en paralelo.
- `npm run local:start`: stack local mas frontend de produccion compilado, en segundo plano.
- `npm run local:start:quick`: igual, reutilizando la ultima compilacion.
- `npm run local:status`: estado y URLs de todos los servicios locales.
- `npm run local:stop`: detiene desarrollo y produccion local.
- `npm run prod:local`: compila y sirve solamente el frontend de produccion local en primer plano.
- `npm run dev:stop`: detiene los servicios locales iniciados en segundo plano.
- `npm run contracts`: regenera tipos TypeScript desde OpenAPI 3.1.
- `npm run lint`: Oxlint para React y el servicio de imágenes.
- `npm test`: Vitest y Pest, incluida la contabilidad transaccional de créditos/cuotas.
- `npm run test:e2e`: nueve perfiles Playwright (Chrome, Edge, DPR 1–2 y Android Chrome).
- `npm run build`: compila Image Service y la PWA de producción.

La implementación y las decisiones de despliegue están en [docs/architecture.md](docs/architecture.md), [docs/local-development.md](docs/local-development.md), [docs/production-readiness.md](docs/production-readiness.md) e `infra/`.

La producción comparte una VM `e2-micro` con Gigantografías mediante Caddy,
PostgreSQL y un único Cloudflare Tunnel; Docker no se ejecuta en la VM. Los
contenedores existen únicamente en Cloud Run. Consulte primero
[docs/production-readiness.md](docs/production-readiness.md).

La integración de IA de producción utiliza exclusivamente FAL. La clave se
carga o rota de forma segura con
`powershell -File infra/gcp/set-fal-key.ps1 -ProjectId PROJECT_ID`; nunca debe
escribirse en el panel web ni guardarse en Git.
