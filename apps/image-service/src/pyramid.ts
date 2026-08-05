import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import sharp from "sharp";
import { config } from "./config.js";
import { downloadObject, uploadObject } from "./storage.js";
import type { PyramidManifest, PyramidRequest } from "./types.js";

export async function buildPyramid(
  request: PyramidRequest,
): Promise<PyramidManifest> {
  const source = await downloadObject(request.source);
  const metadata = await sharp(source, { limitInputPixels: false }).metadata();
  if (!metadata.width || !metadata.height)
    throw new Error("La imagen no contiene dimensiones válidas.");

  const tempRoot = join(
    config.localStoragePath,
    ".tmp",
    request.jobId,
    request.assetId,
  );
  const descriptor = join(tempRoot, "image.dzi");
  await mkdir(dirname(descriptor), { recursive: true });

  try {
    await sharp(source, { limitInputPixels: false, sequentialRead: true })
      .rotate()
      .withMetadata({ icc: "srgb" })
      .webp({ quality: config.TILE_WEBP_QUALITY, smartSubsample: true, effort: 4 })
      .tile({ size: 512, overlap: 1, layout: "dz", depth: "onepixel" })
      .toFile(descriptor);

    const files = await walk(tempRoot);
    const storedSizes = await mapWithConcurrency(
      files,
      config.TILE_UPLOAD_CONCURRENCY,
      async (file) => {
        const generatedName = relative(tempRoot, file).replaceAll("\\", "/");
        const normalizedName = generatedName
          .replace(/^image\.dzi\.dzi$/, "image.dzi")
          .replace(/^image\.dzi_files\//, "image_files/");
        const key = `${request.destinationPrefix}/${normalizedName}`;
        const contentType = file.endsWith(".webp")
          ? "image/webp"
          : "application/xml";
        const contents = await readFile(file);
        await uploadObject(key, contents, contentType);
        return contents.byteLength;
      },
    );

    return {
      width: metadata.width,
      height: metadata.height,
      tileSize: 512,
      overlap: 1,
      format: "webp",
      maxLevel: Math.ceil(Math.log2(Math.max(metadata.width, metadata.height))),
      descriptor: `${request.destinationPrefix}/image.dzi`,
      storedBytes: storedSizes.reduce((total, size) => total + size, 0),
      objectCount: files.length,
    };
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

async function walk(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? walk(path) : Promise.resolve([path]);
    }),
  );
  return nested.flat();
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  operation: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = Array.from<R>({ length: items.length });
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        const item = items[index];
        if (item === undefined) break;
        results[index] = await operation(item);
      }
    },
  );
  await Promise.all(workers);
  return results;
}
