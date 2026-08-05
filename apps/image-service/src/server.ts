import Fastify from "fastify";
import cors from "@fastify/cors";
import { createHash } from "node:crypto";
import sharp from "sharp";
import { config } from "./config.js";
import { notifyApi } from "./callback.js";
import { cancelFalJob, submitFalJob, waitForFalResult } from "./fal.js";
import { buildPyramid } from "./pyramid.js";
import {
  downloadObject,
  downloadOptionalObject,
  uploadObject,
  downloadRemoteObject,
  contentTypeFor,
} from "./storage.js";
import { renderFake } from "./fake.js";
import { verifyFalWebhook, verifyInternalKey } from "./security.js";
import { enqueueFalFinalize } from "./tasks.js";
import {
  falFinalizeRequestSchema,
  processingRequestSchema,
  pyramidRequestSchema,
  type FalFinalizeRequest,
} from "./types.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

const app = Fastify({ logger: true, bodyLimit: 2 * 1024 * 1024 });
await app.register(cors, { origin: false });

app.addHook("onRequest", async (request, reply) => {
  const path = request.url.split("?", 1)[0];
  if (
    config.SERVICE_MODE === "webhook" &&
    path !== "/health" &&
    path !== "/webhooks/fal"
  ) {
    return reply.code(404).send({ message: "Ruta no disponible." });
  }
  if (config.SERVICE_MODE === "worker" && path === "/webhooks/fal") {
    return reply.code(404).send({ message: "Ruta no disponible." });
  }
});

app.addContentTypeParser(
  "application/json",
  { parseAs: "buffer" },
  (request, body, done) => {
    try {
      request.rawBody = Buffer.isBuffer(body) ? body : Buffer.from(body);
      done(null, JSON.parse(request.rawBody.toString("utf8")));
    } catch (error) {
      done(error as Error, undefined);
    }
  },
);

function authorized(value: string | undefined): boolean {
  return verifyInternalKey(value, config.INTERNAL_API_KEY);
}

app.get("/health", async () => ({
  status: "ok",
  service: "altura-image-service",
}));

app.post("/v1/jobs", async (request, reply) => {
  if (!authorized(request.headers["x-internal-key"] as string | undefined)) {
    return reply.code(401).send({ message: "No autorizado." });
  }
  const parsed = processingRequestSchema.safeParse(request.body);
  if (!parsed.success)
    return reply
      .code(422)
      .send({ message: "Solicitud inválida.", errors: parsed.error.flatten() });

  const serializedRequest = JSON.stringify(parsed.data);
  const requestHash = createHash("sha256")
    .update(serializedRequest)
    .digest("hex");
  const receiptObject = `requests/${parsed.data.jobId}.accepted.json`;
  const existingReceipt = await downloadOptionalObject(receiptObject);
  if (existingReceipt) {
    const receipt = JSON.parse(existingReceipt.toString("utf8")) as {
      requestHash?: string;
      providerRequestId?: string;
    };
    if (receipt.requestHash !== requestHash || !receipt.providerRequestId) {
      return reply.code(409).send({
        message:
          "El identificador del trabajo ya fue utilizado con otra solicitud.",
      });
    }
    return reply.code(202).send({
      jobId: parsed.data.jobId,
      providerRequestId: receipt.providerRequestId,
      status: "processing",
      duplicate: true,
    });
  }

  await uploadObject(
    `requests/${parsed.data.jobId}.json`,
    Buffer.from(serializedRequest),
    "application/json",
  );
  const providerRequestId = await submitFalJob(parsed.data);
  await uploadObject(
    receiptObject,
    Buffer.from(JSON.stringify({ requestHash, providerRequestId })),
    "application/json",
  );
  if (config.PROCESSING_DRIVER === "fake") {
    setImmediate(
      () =>
        void processFake(parsed.data, providerRequestId).catch(
          async (error: unknown) => {
            app.log.error(error);
            await notifyApi({
              jobId: parsed.data.jobId,
              status: "failed",
              providerRequestId,
              error:
                error instanceof Error
                  ? error.message
                  : "Falló el proveedor simulado.",
            });
          },
        ),
    );
  } else if (!config.isProduction) {
    setImmediate(
      () => void monitorLocalFalResult(parsed.data, providerRequestId),
    );
  }
  return reply.code(202).send({
    jobId: parsed.data.jobId,
    providerRequestId,
    status: "processing",
  });
});

app.post("/v1/pyramids", async (request, reply) => {
  if (!authorized(request.headers["x-internal-key"] as string | undefined)) {
    return reply.code(401).send({ message: "No autorizado." });
  }
  const parsed = pyramidRequestSchema.safeParse(request.body);
  if (!parsed.success)
    return reply
      .code(422)
      .send({ message: "Solicitud inválida.", errors: parsed.error.flatten() });
  const manifest = await buildPyramid(parsed.data);
  return reply.code(201).send(manifest);
});

app.post("/v1/jobs/:jobId/cancel", async (request, reply) => {
  if (!authorized(request.headers["x-internal-key"] as string | undefined)) {
    return reply.code(401).send({ message: "No autorizado." });
  }
  const params = request.params as { jobId?: string };
  const parsedId = processingRequestSchema.shape.jobId.safeParse(params.jobId);
  if (!parsedId.success) {
    return reply.code(422).send({ message: "Identificador inválido." });
  }
  await uploadObject(
    `requests/${parsedId.data}.cancelled.json`,
    Buffer.from(JSON.stringify({ cancelledAt: new Date().toISOString() })),
    "application/json",
  );
  const requestObject = await downloadOptionalObject(
    `requests/${parsedId.data}.json`,
  );
  const receiptObject = await downloadOptionalObject(
    `requests/${parsedId.data}.accepted.json`,
  );
  if (!requestObject || !receiptObject) {
    return reply.code(202).send({ accepted: true, pending: true });
  }
  const processingRequest = processingRequestSchema.parse(
    JSON.parse(requestObject.toString("utf8")),
  );
  const receipt = JSON.parse(receiptObject.toString("utf8")) as {
    providerRequestId?: string;
  };
  if (receipt.providerRequestId) {
    await cancelFalJob(processingRequest.modelId, receipt.providerRequestId);
  }
  return reply.code(202).send({ accepted: true });
});

app.post("/webhooks/fal", async (request, reply) => {
  if (
    !request.rawBody ||
    !(await verifyFalWebhook(request.headers, request.rawBody))
  ) {
    return reply.code(401).send({ message: "Firma FAL inválida." });
  }
  const query = request.query as { job_id?: string };
  const body = request.body as {
    request_id?: string;
    gateway_request_id?: string;
    status?: string;
    payload?: unknown;
    error?: unknown;
    payload_error?: unknown;
  };
  if (!query.job_id) return reply.code(422).send({ message: "Falta job_id." });
  const receipt = await downloadOptionalObject(
    `requests/${query.job_id}.accepted.json`,
  );
  const accepted = receipt
    ? (JSON.parse(receipt.toString("utf8")) as { providerRequestId?: string })
    : undefined;
  if (
    !accepted?.providerRequestId ||
    !body.request_id ||
    accepted.providerRequestId !== body.request_id
  ) {
    return reply.code(409).send({
      message: "El webhook no corresponde al trabajo enviado al proveedor.",
    });
  }
  const completionObject = `requests/${query.job_id}.completed.json`;
  if (await downloadOptionalObject(completionObject)) {
    return reply.code(202).send({ accepted: true, duplicate: true });
  }

  const finalize = falFinalizeRequestSchema.safeParse({
    jobId: query.job_id,
    requestId: body.request_id,
    status: body.status,
    payload: body.payload,
    error:
      typeof body.error === "string"
        ? body.error
        : typeof body.payload_error === "string"
          ? body.payload_error
          : undefined,
  });
  if (!finalize.success) {
    app.log.warn(
      {
        jobId: query.job_id,
        requestId: body.request_id,
        gatewayRequestId: body.gateway_request_id,
        status: body.status,
        issues: finalize.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      "El webhook FAL no coincide con el contrato esperado.",
    );
    return reply.code(422).send({
      message: "El webhook de FAL no tiene el formato esperado.",
      errors: finalize.error.flatten(),
    });
  }
  if (config.isProduction) {
    await enqueueFalFinalize(finalize.data);
    return reply.code(202).send({ accepted: true, queued: true });
  }
  setImmediate(() => void processLocalFalFinalize(finalize.data));
  return reply.code(202).send({ accepted: true, queued: false, local: true });
});

app.post("/internal/finalize", async (request, reply) => {
  if (!authorized(request.headers["x-internal-key"] as string | undefined)) {
    return reply.code(401).send({ message: "No autorizado." });
  }
  const parsed = falFinalizeRequestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply
      .code(422)
      .send({ message: "Solicitud inválida.", errors: parsed.error.flatten() });
  }
  try {
    const result = await processFalFinalize(parsed.data);
    return reply.code(202).send(result);
  } catch (error) {
    const retryCount = Number(
      request.headers["x-cloudtasks-taskretrycount"] ?? 0,
    );
    if (Number.isFinite(retryCount) && retryCount >= 4) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo finalizar el resultado de FAL.";
      await notifyApi({
        jobId: parsed.data.jobId,
        status: "failed",
        providerRequestId: parsed.data.requestId,
        error: message.slice(0, 2000),
      });
      await uploadObject(
        `requests/${parsed.data.jobId}.completed.json`,
        Buffer.from(
          JSON.stringify({
            status: "failed",
            error: message.slice(0, 2000),
            completedAt: new Date().toISOString(),
          }),
        ),
        "application/json",
      );
      app.log.error(error);
      return reply.code(202).send({ accepted: true, failed: true });
    }
    throw error;
  }
});

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);
  reply.code(500).send({
    message: "El servicio de imágenes no pudo completar la operación.",
  });
});

await app.listen({ host: config.host, port: config.PORT });

async function monitorLocalFalResult(
  request: import("./types.js").ProcessingRequest,
  providerRequestId: string,
): Promise<void> {
  try {
    const payload = await waitForFalResult(request.modelId, providerRequestId);
    await processFalFinalize({
      jobId: request.jobId,
      requestId: providerRequestId,
      status: "OK",
      payload,
    });
  } catch (error) {
    if (
      await downloadOptionalObject(`requests/${request.jobId}.completed.json`)
    )
      return;
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo recuperar el resultado desde la cola FAL.";
    app.log.error({ err: error, jobId: request.jobId }, message);
    await processFalFinalize({
      jobId: request.jobId,
      requestId: providerRequestId,
      status: "ERROR",
      error: message.slice(0, 2000),
    });
  }
}

async function processFake(
  request: import("./types.js").ProcessingRequest,
  providerRequestId: string,
): Promise<void> {
  const source = await downloadObject(request.sourceObject);
  const encoded = await renderFake(source, request);
  await uploadObject(
    request.resultObject,
    encoded,
    contentTypeFor(request.resultObject),
  );
  await complete(request, providerRequestId, encoded);
}

async function processFalFinalize(
  finalize: FalFinalizeRequest,
): Promise<{ accepted: true; duplicate?: true }> {
  const completionObject = `requests/${finalize.jobId}.completed.json`;
  if (await downloadOptionalObject(completionObject)) {
    return { accepted: true, duplicate: true };
  }
  if (
    await downloadOptionalObject(`requests/${finalize.jobId}.cancelled.json`)
  ) {
    await uploadObject(
      completionObject,
      Buffer.from(
        JSON.stringify({
          status: "cancelled",
          completedAt: new Date().toISOString(),
        }),
      ),
      "application/json",
    );
    return { accepted: true };
  }
  const receipt = await downloadOptionalObject(
    `requests/${finalize.jobId}.accepted.json`,
  );
  const accepted = receipt
    ? (JSON.parse(receipt.toString("utf8")) as {
        providerRequestId?: string;
      })
    : undefined;
  if (accepted?.providerRequestId !== finalize.requestId) {
    throw new Error(
      "El trabajo de finalización no coincide con la solicitud FAL.",
    );
  }

  if (finalize.status === "OK") {
    const processingRequest = processingRequestSchema.parse(
      JSON.parse(
        (await downloadObject(`requests/${finalize.jobId}.json`)).toString(
          "utf8",
        ),
      ),
    );
    const resultUrl = findImageUrl(finalize.payload);
    if (!resultUrl) throw new Error("FAL no devolvió una URL de imagen.");
    await notifyApi({
      jobId: finalize.jobId,
      status: "tiling",
      providerRequestId: finalize.requestId,
    });
    const remote = await downloadRemoteObject(resultUrl);
    const result = await encodeOutput(remote, processingRequest.outputFormat);
    await uploadObject(
      processingRequest.resultObject,
      result,
      contentTypeFor(processingRequest.resultObject),
    );
    await complete(processingRequest, finalize.requestId, result);
    await uploadObject(
      completionObject,
      Buffer.from(
        JSON.stringify({
          status: "ready",
          completedAt: new Date().toISOString(),
        }),
      ),
      "application/json",
    );
  } else {
    await notifyApi({
      jobId: finalize.jobId,
      status: "failed",
      providerRequestId: finalize.requestId,
      error: finalize.error ?? "FAL no pudo completar el trabajo.",
    });
    await uploadObject(
      completionObject,
      Buffer.from(
        JSON.stringify({
          status: "failed",
          completedAt: new Date().toISOString(),
        }),
      ),
      "application/json",
    );
  }
  return { accepted: true };
}

async function processLocalFalFinalize(
  finalize: FalFinalizeRequest,
): Promise<void> {
  try {
    await processFalFinalize(finalize);
  } catch (error) {
    app.log.error(error);
    const message =
      error instanceof Error
        ? error.message
        : "No se pudo finalizar el resultado local de FAL.";
    try {
      await notifyApi({
        jobId: finalize.jobId,
        status: "failed",
        providerRequestId: finalize.requestId,
        error: message.slice(0, 2000),
      });
    } catch (callbackError) {
      app.log.error(callbackError);
    }
    await uploadObject(
      `requests/${finalize.jobId}.completed.json`,
      Buffer.from(
        JSON.stringify({
          status: "failed",
          error: message.slice(0, 2000),
          completedAt: new Date().toISOString(),
        }),
      ),
      "application/json",
    );
  }
}

async function complete(
  request: import("./types.js").ProcessingRequest,
  providerRequestId: string,
  result: Buffer,
): Promise<void> {
  const manifest = await buildPyramid({
    jobId: request.jobId,
    assetId: request.jobId,
    source: request.resultObject,
    destinationPrefix: request.resultPyramidPrefix,
  });
  await notifyApi({
    jobId: request.jobId,
    status: "ready",
    providerRequestId,
    resultObject: request.resultObject,
    pyramidPrefix: request.resultPyramidPrefix,
    width: manifest.width,
    height: manifest.height,
    maxLevel: manifest.maxLevel,
    byteSize: result.byteLength,
    storedBytes: result.byteLength + manifest.storedBytes,
    mimeType: contentTypeFor(request.resultObject),
  });
}

function findImageUrl(value: unknown): string | undefined {
  if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  if (Array.isArray(value)) return value.map(findImageUrl).find(Boolean);
  if (value && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      if (/image|url/i.test(key)) {
        const found = findImageUrl(nested);
        if (found) return found;
      }
    }
  }
  return undefined;
}

async function encodeOutput(
  contents: Buffer,
  format: "png" | "jpeg" | "webp",
): Promise<Buffer> {
  const image = sharp(contents, {
    limitInputPixels: false,
    sequentialRead: true,
  });
  if (format === "jpeg")
    return image.jpeg({ quality: 95, mozjpeg: true }).toBuffer();
  if (format === "webp")
    return image.webp({ lossless: true, effort: 4 }).toBuffer();
  return image.png({ compressionLevel: 6 }).toBuffer();
}
