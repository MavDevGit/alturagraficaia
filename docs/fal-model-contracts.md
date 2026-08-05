# Contratos de modelos fal.ai

Revisión realizada el 3 de agosto de 2026. La clave `FAL_KEY` sólo se usa en
`apps/image-service`; nunca debe enviarse al navegador.

| Herramienta | Endpoint | Parámetros enviados a fal.ai |
| --- | --- | --- |
| Escalador IA | `fal-ai/seedvr/upscale/image` | `image_url`, `upscale_mode`, `upscale_factor` o `target_resolution`, `noise_scale`, `output_format`, `sync_mode` |
| Quitar fondo | `fal-ai/bria/background/remove` | `image_url`, `sync_mode` |
| Expandir lienzo | `fal-ai/flux-2-pro/outpaint` | `image_url`, cuatro márgenes `expand_*`, `auto_crop`, `mode`, `enable_safety_checker`, `output_format`, `sync_mode` |

## Adaptaciones internas

- SeedVR2 usa `jpg`; la API pública de la aplicación conserva el nombre `jpeg`
  y el adaptador lo convierte antes de llamar a fal.ai.
- Bria RMBG 2.0 devuelve PNG transparente y no acepta controles de formato,
  máscara ni refinamiento.
- FLUX.2 Pro Outpaint sólo genera `jpeg` o `png`. Para una descarga WebP se
  solicita PNG a fal.ai y la conversión final se realiza en el servicio local.
- El endpoint de Outpaint no acepta `prompt`; la expansión se controla mediante
  los cuatro márgenes y el modo `high` o `fast`.

## Fuentes oficiales

- [SeedVR2 Upscale Image](https://fal.ai/models/fal-ai/seedvr/upscale/image/api)
- [Bria RMBG 2.0 Background Remove](https://fal.ai/models/fal-ai/bria/background/remove/api)
- [FLUX.2 Pro Outpaint](https://fal.ai/models/fal-ai/flux-2-pro/outpaint/api)
