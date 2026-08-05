# FAL real desde la PC local

Este entorno usa la cola asincrona de FAL. La clave permanece en
`apps/image-service/.env`, que esta ignorado por Git, y el resultado vuelve por
un webhook HTTPS firmado. No pegue la clave en el panel web, en Git ni en una
linea de comandos.

## Requisitos

- Una `FAL_KEY` activa y saldo disponible en FAL.
- `cloudflared` instalado.
- Un dominio administrado por Cloudflare.
- Un hostname administrado por Cloudflare. En este proyecto se reutiliza
  `alturagrafica.mavdev.cloud` para la PWA y para el webhook.

## 1. Preparar el tunel

```powershell
cloudflared tunnel login
cloudflared tunnel create alturagrafica-local
cloudflared tunnel route dns --overwrite-dns alturagrafica-local alturagrafica.mavdev.cloud
```

Copie `infra/cloudflared/config.local-windows.yml.example` a
`%USERPROFILE%\.cloudflared\config.yml` y reemplace el UUID, usuario de Windows
y el UUID. Valide y arranque:

```powershell
cloudflared tunnel ingress validate
cloudflared tunnel run alturagrafica-local
```

La plantilla publica `/webhooks/fal` y envia el resto del hostname a
`127.0.0.1:4173`. No se necesita un segundo subdominio: las reglas de ingreso
del mismo hostname se evalúan por ruta y en orden. La PWA reenvia `/api/*` a
Laravel en `127.0.0.1:8000`.

La cuenta de Cloudflare tiene dos aplicaciones de Access:

- `Altura Gráfica IA local`: protege todo `alturagrafica.mavdev.cloud` y solo
  permite el correo administrador del proyecto.
- `Webhook FAL público firmado`: aplica `Bypass` a `/webhooks/fal` para que FAL
  pueda responder y a `/health` para supervisar el tunel sin iniciar sesion.

No quite la primera proteccion mientras use `VITE_AUTH_DRIVER=local`, porque ese
modo concede acceso administrador sin contrasena. El webhook queda fuera de
Access, pero conserva la verificacion criptografica de FAL.

## 2. Guardar la clave y habilitar FAL

Con el tunel activo:

```powershell
powershell -File scripts/set-fal-key-local.ps1 `
  -WebhookUrl https://alturagrafica.mavdev.cloud/webhooks/fal
npm run local:stop
npm run local:start:quick
```

El script solicita la clave mediante entrada oculta, establece
`PROCESSING_DRIVER=fal`, registra el webhook y actualiza unicamente los
metadatos que muestra Administracion. La clave real nunca llega a Laravel ni al
navegador.

## 3. Comprobar

```powershell
npm run local:status
curl.exe https://alturagrafica.mavdev.cloud/health
```

Abra `http://127.0.0.1:4173`, ingrese al entorno local y procese primero una
imagen pequena. Estas solicitudes usan saldo real de FAL. En desarrollo la
finalizacion se ejecuta directamente en Image Service; Cloud Tasks se reserva
para Cloud Run en produccion real.

La documentacion oficial de FAL recomienda la cola asincrona y webhooks, y su
CDN para archivos de entrada locales:

- https://fal.ai/docs/documentation/model-apis/inference/queue
- https://fal.ai/docs/documentation/model-apis/fal-cdn

Cloudflare documenta la creacion y configuracion de tuneles locales en:

- https://developers.cloudflare.com/tunnel/advanced/local-management/create-local-tunnel/
- https://developers.cloudflare.com/tunnel/advanced/local-management/configuration-file/
