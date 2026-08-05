import sharp from "sharp";
import type { ProcessingRequest } from "./types.js";

export async function renderFake(
  source: Buffer,
  request: ProcessingRequest,
): Promise<Buffer> {
  const image = sharp(source, { limitInputPixels: false }).rotate();
  const metadata = await image.metadata();
  const scale =
    request.tool === "upscaler"
      ? fakeUpscaleFactor(request, metadata.width ?? 1, metadata.height ?? 1)
      : 1;
  let output = image;
  if (request.tool === "upscaler" && metadata.width && metadata.height) {
    const width = Math.ceil((metadata.width * scale) / 16) * 16;
    const height = Math.ceil((metadata.height * scale) / 16) * 16;
    output = output
      .resize(width, height, { kernel: sharp.kernel.lanczos3 })
      .sharpen({ sigma: 0.6 });
  } else if (request.tool === "outpainting") {
    output = output.extend({
      top: 160,
      right: 160,
      bottom: 160,
      left: 160,
      background: { r: 246, g: 247, b: 249, alpha: 1 },
    });
  }
  if (request.outputFormat === "jpeg")
    return output.jpeg({ quality: 95 }).toBuffer();
  if (request.outputFormat === "webp")
    return output.webp({ lossless: true }).toBuffer();
  return output.png({ compressionLevel: 6 }).toBuffer();
}

function fakeUpscaleFactor(
  request: ProcessingRequest,
  width: number,
  height: number,
): number {
  if (request.input.upscaleMode !== "target") {
    return Number(request.input.scale ?? 2);
  }
  const target =
    (
      {
        "720p": 720,
        "1080p": 1080,
        "1440p": 1440,
        "2160p": 2160,
      } as Record<string, number>
    )[String(request.input.targetResolution)] ?? 1080;
  return target / Math.max(1, Math.min(width, height));
}
