import assert from "node:assert/strict";
import test from "node:test";

import { handleRequest, signCanonical } from "../src/index.js";

const secret = "proxy-test-secret-with-at-least-thirty-two-characters";
const now = 1_786_579_200;
const env = {
  ALLOWED_WEBHOOK_ORIGIN: "https://alturagrafica.mavdev.cloud",
  FAL_KEY: "fal-test-key",
  PROXY_HMAC_SECRET: secret,
};

async function signedRequest(path, { method = "GET", body = "" } = {}) {
  const timestamp = String(now);
  const signature = await signCanonical(secret, timestamp, method, path, new TextEncoder().encode(body));
  const headers = {
    "X-Altura-Timestamp": timestamp,
    "X-Altura-Signature": signature,
  };
  if (body) headers["Content-Type"] = "application/json";
  return new Request(`https://proxy.example${path}`, { method, headers, body: body || undefined });
}

test("forwards an authenticated upload-initiation request only to the fixed FAL host", async () => {
  const path = "/v1/rest-alpha/storage/upload/initiate?storage_type=fal-cdn-v3";
  const request = await signedRequest(path, { method: "POST", body: '{"file_name":"source.png"}' });
  let forwarded;
  const response = await handleRequest(
    request,
    env,
    async (url, init) => {
      forwarded = { url, init };
      return Response.json({ upload_url: "https://upload.fal.media/ticket" }, { status: 201 });
    },
    now,
  );

  assert.equal(response.status, 201);
  assert.equal(forwarded.url, "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3");
  assert.equal(forwarded.init.headers.get("Authorization"), "Key fal-test-key");
});

test("allows a queue request only with the production webhook origin", async () => {
  const webhook = encodeURIComponent(
    "https://alturagrafica.mavdev.cloud/api/internal/fal-webhook?job_id=019ffbc1-5970-7df3-b80c-bbdfc479126f",
  );
  const path = `/v1/queue/fal-ai/seedvr/upscale/image?fal_webhook=${webhook}`;
  const request = await signedRequest(path, { method: "POST", body: '{"image_url":"https://v3b.fal.media/a"}' });
  let target;
  const response = await handleRequest(
    request,
    env,
    async (url) => {
      target = url;
      return Response.json({ request_id: "request-1" }, { status: 202 });
    },
    now,
  );

  assert.equal(response.status, 202);
  assert.match(target, /^https:\/\/queue\.fal\.run\/fal-ai\/seedvr\/upscale\/image\?fal_webhook=/);
});

test("probes only HTTPS media hosted below fal.media without exposing the FAL key", async () => {
  const mediaUrl = "https://v3b.fal.media/files/image.png?token=signed";
  const path = `/v1/media/probe?url=${encodeURIComponent(mediaUrl)}`;
  const request = await signedRequest(path, { method: "HEAD" });
  let forwarded;
  const response = await handleRequest(
    request,
    env,
    async (url, init) => {
      forwarded = { url, init };
      return new Response(null, { status: 200, headers: { "Content-Length": "1234" } });
    },
    now,
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Content-Length"), "1234");
  assert.equal(forwarded.url, mediaUrl);
  assert.equal(forwarded.init.method, "HEAD");
  assert.equal(forwarded.init.headers.has("Authorization"), false);

  const evilPath = `/v1/media/probe?url=${encodeURIComponent("https://fal.media.evil.example/file.png")}`;
  const forbidden = await signedRequest(evilPath, { method: "HEAD" });
  assert.equal((await handleRequest(forbidden, env, fetch, now)).status, 403);
});

test("rejects unsigned, stale, tampered, and open-proxy requests", async () => {
  const unsigned = await handleRequest(new Request("https://proxy.example/v1/rest/.well-known/jwks.json"), env, fetch, now);
  assert.equal(unsigned.status, 401);

  const path = "/v1/rest/.well-known/jwks.json";
  const signed = await signedRequest(path);
  const stale = await handleRequest(signed, env, fetch, now + 301);
  assert.equal(stale.status, 401);

  const tampered = await signedRequest(path, { method: "POST", body: "{}" });
  const tamperedResponse = await handleRequest(tampered, env, fetch, now);
  assert.equal(tamperedResponse.status, 404);

  const forbiddenPath = "/v1/queue/fal-ai/model?fal_webhook=https%3A%2F%2Fevil.example%2Fhook%3Fjob_id%3D1";
  const forbidden = await signedRequest(forbiddenPath, { method: "POST", body: "{}" });
  const forbiddenResponse = await handleRequest(forbidden, env, fetch, now);
  assert.equal(forbiddenResponse.status, 403);

  const unknownWebhook = encodeURIComponent(
    "https://alturagrafica.mavdev.cloud/api/internal/fal-webhook?job_id=job-1",
  );
  const unknownPath = `/v1/queue/fal-ai/unknown/model?fal_webhook=${unknownWebhook}`;
  const unknown = await signedRequest(unknownPath, { method: "POST", body: "{}" });
  const unknownResponse = await handleRequest(unknown, env, fetch, now);
  assert.equal(unknownResponse.status, 403);
});
