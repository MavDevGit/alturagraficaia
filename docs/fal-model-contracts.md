# Contratos de modelos FAL

Los nombres de modelos y sus ajustes se definen en `tool_settings` y se validan en Laravel antes de llamar FAL Queue.

- `upscaler`: recibe `image_url`, `scale` y fidelidad/textura segun el modelo activo.
- `background_removal`: recibe `image_url` y solicita salida con transparencia.
- `outpainting`: recibe `image_url`, proporcion o dimensiones objetivo, direccion, prompt y calidad.

`App\Services\FalClient` es la unica integracion de salida. Inicia cargas firmadas, crea solicitudes de cola, cancela solicitudes y restringe referencias multimedia a HTTPS de FAL. `FalWebhookVerifier` valida el cuerpo crudo antes de que `FalWebhookController` acepte el resultado.
