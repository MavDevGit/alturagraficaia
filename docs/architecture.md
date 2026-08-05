# Arquitectura de producción

La PWA React consume `/api/v1` y usa Firebase Authentication. Laravel valida el
ID token, conserva usuarios, créditos, trabajos y cuotas en PostgreSQL, y guarda
originales, resultados y mosaicos en un bucket privado de Cloud Storage.

```text
Internet → Cloudflare Tunnel → Caddy 127.0.0.1:8082
                              ├─ React estático
                              └─ Laravel/PHP-FPM → PostgreSQL
                                         │
                                         └─ OIDC → Cloud Run worker privado → FAL
FAL → Cloud Run webhook público → Cloud Tasks/OIDC → worker privado
                                                   └─ GCS + callback HMAC a Laravel
```

La VM `e2-micro` se comparte con Gigantografías, pero cada aplicación tiene su
propio puerto Caddy, usuario Linux, pool PHP-FPM, base de datos, worker, releases
y archivos de entorno. No se instala Docker, Nginx, otro PostgreSQL ni otro
`cloudflared` en la VM. El túnel compartido enruta cada hostname a su puerto
loopback y la VM continúa sin IPv4 pública ni reglas de ingreso web.

El procesamiento pesado se separa en dos servicios Cloud Run. El receptor de
webhooks es público, pequeño y no procesa imágenes. El worker es privado, acepta
OIDC únicamente desde Cloud Tasks y la cuenta de la VM, limita escala y
concurrencia a uno, y genera Deep Zoom WebP de 512 × 512. Laravel entrega URLs
firmadas temporales para mosaicos y descargas, de modo que los bytes de GCS no
atraviesan la memoria limitada de la VM.

## Controles de Free Tier

- Una sola `e2-micro` y un único disco estándar de 30 GB: no se crea otra VM.
- Cloud Run: worker `maxScale=1`, concurrencia uno y límite conservador de 100
  trabajos de IA por mes; el webhook también escala como máximo a uno.
- Cloud Storage: límite aplicativo global de 4 GiB para medios, eliminación a
  siete días, prevención de acceso público y sin soft delete para datos
  efímeros. Los backups cifrados usan otro bucket y retención de 30 días.
- Operaciones GCS: Laravel reserva el número estimado de objetos de cada
  pirámide y detiene nuevos trabajos antes de 4.700 operaciones Class A/mes.
- Cloud Tasks: una cola, una ejecución concurrente y reintentos acotados.
- Artifact Registry conserva tres imágenes recientes y elimina las antiguas.
- Secret Manager mantiene solo secretos de runtime; no hay claves JSON.

Los límites aplicativos reducen el riesgo, pero no son un tope de facturación.
FAL, dominios, exceso de red/almacenamiento y cualquier consumo fuera de las
cuotas gratuitas siguen siendo facturables; deben existir alertas de presupuesto.
