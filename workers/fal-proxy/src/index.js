const MAX_CLOCK_SKEW_SECONDS = 300;
const MAX_BODY_BYTES = 1024 * 1024;
const SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/;
const SUBMIT_MODELS = new Set([
  "fal-ai/seedvr/upscale/image",
  "fal-ai/bria/background/remove",
  "fal-ai/flux-2-pro/outpaint",
]);
const CANCEL_MODELS = new Set(["fal-ai/seedvr", "fal-ai/bria", "fal-ai/flux-2-pro"]);

export default {
  fetch(request, env) {
    return handleRequest(request, env);
  },
};

export async function handleRequest(
  request,
  env,
  upstreamFetch = fetch,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const requestUrl = new URL(request.url);
  if (request.method === "GET" && requestUrl.pathname === "/healthz" && requestUrl.search === "") {
    return jsonResponse({ ok: true });
  }

  if (!env.FAL_KEY || !env.PROXY_HMAC_SECRET || !env.ALLOWED_WEBHOOK_ORIGIN) {
    return jsonResponse({ error: "Proxy is not configured" }, 503);
  }

  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request body is too large" }, 413);
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength > MAX_BODY_BYTES) {
    return jsonResponse({ error: "Request body is too large" }, 413);
  }

  if (!(await validSignature(request, requestUrl, body, env.PROXY_HMAC_SECRET, nowSeconds))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const target = resolveTarget(request.method, requestUrl, env.ALLOWED_WEBHOOK_ORIGIN);
  if (target instanceof Response) {
    return target;
  }

  const upstreamHeaders = new Headers({ Accept: "application/json" });
  if (body.byteLength > 0) {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      return jsonResponse({ error: "Only JSON request bodies are accepted" }, 415);
    }
    upstreamHeaders.set("Content-Type", "application/json");
  }

  const lifecycle = request.headers.get("x-fal-object-lifecycle-preference");
  if (lifecycle) {
    if (lifecycle.length > 512) {
      return jsonResponse({ error: "Lifecycle header is too large" }, 400);
    }
    upstreamHeaders.set("X-Fal-Object-Lifecycle-Preference", lifecycle);
  }
  if (target.authenticated) {
    upstreamHeaders.set("Authorization", `Key ${env.FAL_KEY}`);
  }

  let upstream;
  try {
    upstream = await upstreamFetch(target.url, {
      method: request.method,
      headers: upstreamHeaders,
      body: body.byteLength > 0 ? body : undefined,
      redirect: "manual",
    });
  } catch {
    return jsonResponse({ error: "FAL is temporarily unavailable" }, 502);
  }

  const responseHeaders = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": upstream.headers.get("content-type") || "application/json",
  });
  for (const name of ["content-length", "x-fal-request-id", "retry-after"]) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export function resolveTarget(method, requestUrl, allowedWebhookOrigin) {
  if (
    method === "POST" &&
    requestUrl.pathname === "/v1/rest-alpha/storage/upload/initiate" &&
    requestUrl.searchParams.size === 1 &&
    requestUrl.searchParams.get("storage_type") === "fal-cdn-v3"
  ) {
    return {
      authenticated: true,
      url: "https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3",
    };
  }

  if (method === "GET" && requestUrl.pathname === "/v1/rest/.well-known/jwks.json" && requestUrl.search === "") {
    return { authenticated: false, url: "https://rest.fal.ai/.well-known/jwks.json" };
  }

  if (method === "HEAD" && requestUrl.pathname === "/v1/media/probe") {
    const targetValues = requestUrl.searchParams.getAll("url");
    if (requestUrl.searchParams.size !== 1 || targetValues.length !== 1) {
      return jsonResponse({ error: "A single media URL is required" }, 400);
    }

    let targetUrl;
    try {
      targetUrl = new URL(targetValues[0]);
    } catch {
      return jsonResponse({ error: "Invalid media URL" }, 400);
    }
    if (
      targetUrl.protocol !== "https:" ||
      targetUrl.port !== "" ||
      targetUrl.username !== "" ||
      targetUrl.password !== "" ||
      targetUrl.hash !== "" ||
      (targetUrl.hostname !== "fal.media" && !targetUrl.hostname.endsWith(".fal.media"))
    ) {
      return jsonResponse({ error: "Media URL is not allowed" }, 403);
    }

    return { authenticated: false, url: targetUrl.toString() };
  }

  if (requestUrl.pathname.startsWith("/v1/queue/")) {
    const segments = safeSegments(requestUrl.pathname.slice("/v1/queue/".length));
    if (!segments) return jsonResponse({ error: "Invalid queue path" }, 400);

    if (method === "POST") {
      if (!SUBMIT_MODELS.has(segments.join("/"))) {
        return jsonResponse({ error: "Model is not allowed" }, 403);
      }
      const webhookValues = requestUrl.searchParams.getAll("fal_webhook");
      if (requestUrl.searchParams.size !== 1 || webhookValues.length !== 1) {
        return jsonResponse({ error: "A single fal_webhook is required" }, 400);
      }
      let webhook;
      try {
        webhook = new URL(webhookValues[0]);
      } catch {
        return jsonResponse({ error: "Invalid webhook URL" }, 400);
      }
      if (
        webhook.origin !== allowedWebhookOrigin ||
        webhook.pathname !== "/api/internal/fal-webhook" ||
        webhook.searchParams.size !== 1 ||
        !/^[A-Za-z0-9-]{1,128}$/.test(webhook.searchParams.get("job_id") || "")
      ) {
        return jsonResponse({ error: "Webhook URL is not allowed" }, 403);
      }
      return {
        authenticated: true,
        url: `https://queue.fal.run/${segments.join("/")}?fal_webhook=${encodeURIComponent(webhook.toString())}`,
      };
    }

    if (
      method === "PUT" &&
      requestUrl.search === "" &&
      segments.length === 5 &&
      segments[2] === "requests" &&
      segments[4] === "cancel"
    ) {
      if (!CANCEL_MODELS.has(segments.slice(0, 2).join("/"))) {
        return jsonResponse({ error: "Model is not allowed" }, 403);
      }
      return { authenticated: true, url: `https://queue.fal.run/${segments.join("/")}` };
    }
  }

  return jsonResponse({ error: "Route is not allowed" }, 404);
}

export async function signCanonical(secret, timestamp, method, pathAndQuery, body) {
  const bodyHash = await sha256Hex(body);
  const canonical = ["v1", timestamp, method.toUpperCase(), pathAndQuery, bodyHash].join("\n");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return bytesToHex(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(canonical))));
}

async function validSignature(request, requestUrl, body, secret, nowSeconds) {
  const timestamp = request.headers.get("x-altura-timestamp") || "";
  const supplied = request.headers.get("x-altura-signature") || "";
  if (!/^\d{10}$/.test(timestamp) || !/^[a-f0-9]{64}$/.test(supplied)) return false;
  if (Math.abs(nowSeconds - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) return false;

  const expected = await signCanonical(
    secret,
    timestamp,
    request.method,
    `${requestUrl.pathname}${requestUrl.search}`,
    body,
  );
  return constantTimeHexEqual(expected, supplied);
}

function safeSegments(suffix) {
  if (!suffix || suffix.includes("\\") || /%2f|%5c/i.test(suffix)) return null;
  const parts = suffix.split("/");
  if (parts.length < 2 || parts.some((part) => !SEGMENT_PATTERN.test(part) || part === "." || part === "..")) {
    return null;
  }
  return parts;
}

async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : new TextEncoder().encode(value);
  return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)));
}

function constantTimeHexEqual(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return difference === 0;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(value, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store" } });
}
