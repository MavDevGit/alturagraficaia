import sharp from '../apps/image-service/node_modules/sharp/dist/index.mjs'
import { resolve } from 'node:path'

const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="132" fill="#14c38e"/><path d="M126 366 229 126h56l103 240h-65l-22-56h-93l-22 56Zm106-112h52l-26-72Z" fill="#07130f"/><circle cx="386" cy="128" r="34" fill="#f6f7f9"/></svg>`)
const target = resolve(process.cwd(), 'apps/web/public')
await Promise.all([192, 512].map((size) => sharp(svg).resize(size, size).png().toFile(resolve(target, `pwa-${size}x${size}.png`))))
