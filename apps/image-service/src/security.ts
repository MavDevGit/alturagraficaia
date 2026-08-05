import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import sodium from "libsodium-wrappers";

const jwksUrl = "https://rest.fal.ai/.well-known/jwks.json";
let jwksCache: { keys: Array<{ x?: string }>; expiresAt: number } | undefined;

export function signCallback(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function verifyInternalKey(
  value: string | undefined,
  expected: string,
): boolean {
  if (!value) return false;
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function getJwks(): Promise<Array<{ x?: string }>> {
  if (jwksCache && jwksCache.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch(jwksUrl, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error(`No se pudo consultar JWKS de FAL (${response.status}).`);
  const payload = (await response.json()) as { keys?: Array<{ x?: string }> };
  const keys = payload.keys ?? [];
  jwksCache = { keys, expiresAt: Date.now() + 24 * 60 * 60 * 1000 };
  return keys;
}

export async function verifyFalWebhook(
  headers: Record<string, string | string[] | undefined>,
  rawBody: Buffer,
): Promise<boolean> {
  const requestId = String(headers["x-fal-webhook-request-id"] ?? "");
  const userId = String(headers["x-fal-webhook-user-id"] ?? "");
  const timestamp = String(headers["x-fal-webhook-timestamp"] ?? "");
  const signatureHex = String(headers["x-fal-webhook-signature"] ?? "");
  if (!requestId || !userId || !timestamp || !signatureHex) return false;

  const timestampNumber = Number(timestamp);
  if (
    !Number.isFinite(timestampNumber) ||
    Math.abs(Date.now() / 1000 - timestampNumber) > 300
  ) {
    return false;
  }

  const digest = createHash("sha256").update(rawBody).digest("hex");
  const message = Buffer.from(
    [requestId, userId, timestamp, digest].join("\n"),
  );
  const signature = Buffer.from(signatureHex, "hex");
  await sodium.ready;

  for (const key of await getJwks()) {
    if (!key.x) continue;
    const publicKey = Buffer.from(key.x, "base64url");
    if (sodium.crypto_sign_verify_detached(signature, message, publicKey))
      return true;
  }
  return false;
}
