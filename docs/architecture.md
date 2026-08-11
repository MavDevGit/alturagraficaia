# Arquitectura de produccion

```text
navegador -- JSON autenticado --> Laravel/PHP-FPM --> PostgreSQL
    |                                  |
    |-- archivo completo ------------> FAL
    |                                  |-- solicitud JSON --> FAL Queue
    |<----------- imagen CDN ----------|
                                       ^
                                       | webhook firmado de FAL

PostgreSQL -- backup cifrado diario --> bucket privado de backups
```

Laravel inicia una URL de carga firmada y devuelve solo sus metadatos al navegador. El navegador envia el binario directamente a FAL, sin pasar por PHP, la VM ni almacenamiento intermedio. Laravel confirma que la URL existe y crea el trabajo en FAL Queue. El webhook Ed25519 registra la URL final, dimensiones, tipo y estado de creditos de forma idempotente.

La VM permanece sin IPv4 publica. Un Cloud NAT regional permite solo su trafico saliente de control hacia FAL (tickets, cola y cancelaciones); los binarios de imagen no atraviesan el NAT ni Laravel.

El visor y la descarga usan la imagen completa del CDN de FAL. No se generan archivos derivados para comparar, por lo que el zoom por sectores es solo renderizado del visor en el navegador y no procesamiento del servidor.

## Historial y retencion

Originales y resultados solicitan siete dias de ciclo de vida en FAL. PostgreSQL conserva metadatos del trabajo y la URL hasta `expires_at`; la tarea horaria marca referencias vencidas. Una vez expirada la URL, el historial mantiene la operacion pero no el archivo.

## Persistencia en Google

El unico bucket contiene backups cifrados de PostgreSQL. Sirve para recuperar usuarios, saldos, trabajos, configuracion e historial ante corrupcion o perdida de la VM. No permite recuperar una imagen que ya expiro en FAL porque esos binarios no forman parte del backup.

## Controles

- La clave FAL permanece en Secret Manager y solo la lee la cuenta de la VM.
- Los webhooks se validan con timestamp, firma Ed25519 y JWKS oficial cacheado.
- La reserva/captura/reembolso de creditos es transaccional e idempotente.
- Los limites de entrada protegen al producto; la descarga del resultado no impone limite de megapixeles ni MB.
- Un backup cifrado se ejecuta diariamente y tiene retencion de 30 dias.
