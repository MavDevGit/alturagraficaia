# Arquitectura de producción

La PWA React consume `/api/v1` y usa Firebase Authentication. Laravel valida el
ID token, conserva usuarios, créditos, trabajos y cuotas en PostgreSQL, y guarda
únicamente los originales en un bucket privado de Cloud Storage.

```text
Internet → Cloudflare Tunnel → Caddy 127.0.0.1:8082
                              ├─ React estático
                              └─ Laravel/PHP-FPM → PostgreSQL
                                         │
                                         └─ OIDC → Cloud Run worker privado → FAL
FAL → Cloud Run webhook → Cloud Tasks/OIDC → worker → callback HMAC a Laravel
 │                                                         │
 └──────── imagen completa por CDN ────────────────────────┴→ navegador
```

El resultado no pasa por GCS, Cloud Run ni la VM. El worker sólo coordina JSON:
envía el original a FAL, valida el webhook y registra en Laravel la URL HTTPS,
dimensiones y tipo MIME. El visor y la descarga siguen una redirección temporal
del API a la CDN de FAL. No se generan pirámides Deep Zoom, mosaicos WebP ni una
segunda copia del resultado.

La VM `e2-micro` se comparte con Gigantografías, pero cada aplicación tiene su
propio puerto Caddy, usuario Linux, pool PHP-FPM, base de datos, worker, releases
y archivos de entorno. No se instala Docker, Nginx, otro PostgreSQL ni otro
`cloudflared` en la VM.

## Historial y retención

FAL recibe `X-Fal-Object-Lifecycle-Preference` con 604.800 segundos. PostgreSQL
conserva el trabajo y la referencia hasta la misma fecha; el proceso horario la
marca como vencida. Esto es suficiente para el historial temporal de siete días
y evita almacenar resultados en GCS.

Las URL de la CDN de FAL son públicas para quien conozca el enlace mientras no
caduquen. GCS para resultados sólo sería necesario si el producto exige alguno
de estos requisitos: acceso privado revocable por usuario, recuperación después
de que FAL expire el archivo, retención garantizada independiente del proveedor,
auditoría legal o borrado inmediato verificable. Los originales sí permanecen
privados en GCS porque son la entrada necesaria para FAL.

## Controles de consumo

- Una sola `e2-micro` y un único disco estándar de 30 GB: no se crea otra VM.
- Cloud Run usa `minScale=0`, `maxScale=1`, 1 CPU y 512 MiB; no decodifica ni
  transforma imágenes y permite concurrencia de solicitudes de coordinación.
- Cloud Storage contiene un objeto por original y pequeños recibos JSON de
  idempotencia. Ya no recibe resultados ni miles de objetos por pirámide.
- Las lecturas y la transferencia GCS sólo corresponden a originales. Los bytes
  de los resultados viajan desde FAL directamente al navegador.
- Cloud Tasks mantiene una cola con reintentos acotados; Artifact Registry
  conserva la imagen más reciente y Secret Manager no usa claves JSON.
- Un presupuesto mensual de USD 5 avisa al 10 %, 50 %, 90 % y 100 %.

Los límites aplicativos reducen el riesgo, pero no son un tope de facturación.
FAL, dominios y consumos fuera de las cuotas gratuitas siguen siendo facturables.
