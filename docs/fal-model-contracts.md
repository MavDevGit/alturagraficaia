# Contratos de modelos FAL

Los nombres de modelos y sus ajustes se definen en `tool_settings` y se validan en Laravel antes de llamar FAL Queue.

- `upscaler`: `fal-ai/seedvr/upscale/image`; recibe modo, factor o resolucion objetivo, fidelidad y formato.
- `background-remover`: `fal-ai/bria/background/remove`; recibe `image_url` y devuelve `image` como PNG transparente.
- `outpainting`: `fal-ai/flux-2-pro/outpaint`; recibe expansiones por lado, modo `high|fast`, formato `png|jpeg` y devuelve la primera entrada de `images`.

`App\Services\FalClient` es la unica integracion de salida. Inicia cargas firmadas, crea solicitudes de cola, cancela solicitudes y restringe referencias multimedia a HTTPS de FAL. `FalWebhookVerifier` valida el cuerpo crudo antes de que `FalWebhookController` acepte el resultado.
