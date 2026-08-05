import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Storage } from "@google-cloud/storage";
import { config } from "./config.js";

const gcs = config.GCS_BUCKET
  ? new Storage({ projectId: config.GCP_PROJECT_ID })
  : undefined;

function localPath(objectName: string): string {
  const root = resolve(config.localStoragePath);
  const destination = resolve(root, ...objectName.split("/"));
  if (destination !== root && !destination.startsWith(`${root}${sep}`)) {
    throw new Error("La ruta solicitada sale del almacenamiento permitido.");
  }
  return destination;
}

export async function downloadObject(objectName: string): Promise<Buffer> {
  if (gcs && config.GCS_BUCKET) {
    const [contents] = await gcs
      .bucket(config.GCS_BUCKET)
      .file(objectName)
      .download();
    return contents;
  }
  return readFile(localPath(objectName));
}

export async function downloadOptionalObject(
  objectName: string,
): Promise<Buffer | undefined> {
  try {
    return await downloadObject(objectName);
  } catch (error) {
    const code = (error as { code?: string | number }).code;
    if (code === "ENOENT" || code === 404) return undefined;
    throw error;
  }
}

export async function getModelInputUrl(objectName: string): Promise<string> {
  if (gcs && config.GCS_BUCKET) {
    const [url] = await gcs
      .bucket(config.GCS_BUCKET)
      .file(objectName)
      .getSignedUrl({
        version: "v4",
        action: "read",
        expires: Date.now() + 2 * 60 * 60 * 1000,
      });
    return url;
  }

  const contents = await downloadObject(objectName);
  if (config.PROCESSING_DRIVER === "fal" && config.FAL_KEY) {
    const { fal } = await import("@fal-ai/client");
    fal.config({ credentials: config.FAL_KEY });
    const filename = objectName.split("/").at(-1) ?? "input-image";
    const file = new File([new Uint8Array(contents)], filename, {
      type: contentTypeFor(objectName),
    });
    return fal.storage.upload(file);
  }
  return `data:${contentTypeFor(objectName)};base64,${contents.toString("base64")}`;
}

export async function uploadObject(
  objectName: string,
  contents: Buffer,
  contentType: string,
): Promise<void> {
  if (gcs && config.GCS_BUCKET) {
    await gcs
      .bucket(config.GCS_BUCKET)
      .file(objectName)
      .save(contents, {
        contentType,
        resumable: false,
        metadata: { cacheControl: "private, max-age=604800" },
      });
    return;
  }
  const destination = localPath(objectName);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, contents);
}

export async function copyObject(
  source: string,
  destination: string,
): Promise<void> {
  await uploadObject(
    destination,
    await downloadObject(source),
    contentTypeFor(destination),
  );
}

export async function downloadRemoteObject(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok)
    throw new Error(
      `No se pudo descargar el resultado remoto (${response.status}).`,
    );
  if (new URL(response.url).protocol !== "https:") {
    throw new Error("El proveedor devolvió una URL de resultado insegura.");
  }
  const declaredSize = Number(response.headers.get("content-length") ?? 0);
  if (declaredSize > config.MAX_REMOTE_BYTES) {
    throw new Error("El resultado remoto supera el tamaño máximo permitido.");
  }
  if (!response.body) throw new Error("El resultado remoto no contiene datos.");
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > config.MAX_REMOTE_BYTES) {
      await reader.cancel();
      throw new Error("El resultado remoto supera el tamaño máximo permitido.");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

export function contentTypeFor(objectName: string): string {
  if (/\.jpe?g$/i.test(objectName)) return "image/jpeg";
  if (/\.webp$/i.test(objectName)) return "image/webp";
  if (/\.png$/i.test(objectName)) return "image/png";
  return "application/octet-stream";
}
