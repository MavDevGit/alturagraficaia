import { config } from "./config.js";
import { getModelInputUrl } from "./storage.js";
import type { ProcessingRequest } from "./types.js";

type SubmitResult = { request_id: string };
type QueueStatus = { status?: string };

class FalQueueError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export const supportedFalModels = {
  upscaler: "fal-ai/seedvr/upscale/image",
  background_remover: "fal-ai/bria/background/remove",
  outpainting: "fal-ai/flux-2-pro/outpaint",
} as const;

export async function submitFalJob(
  request: ProcessingRequest,
): Promise<string> {
  if (config.PROCESSING_DRIVER === "fake") return `fake-${request.jobId}`;
  if (!config.FAL_KEY || !config.FAL_WEBHOOK_URL) {
    throw new Error(
      "FAL_KEY y FAL_WEBHOOK_URL son obligatorios con PROCESSING_DRIVER=fal.",
    );
  }

  const webhook = new URL(config.FAL_WEBHOOK_URL);
  webhook.searchParams.set("job_id", request.jobId);
  const endpoint = new URL(`https://queue.fal.run/${request.modelId}`);
  endpoint.searchParams.set("fal_webhook", webhook.toString());
  const imageUrl = await getModelInputUrl(request.sourceObject);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Key ${config.FAL_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(buildFalInput(request, imageUrl)),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(
      `FAL rechazó el trabajo (${response.status}): ${detail.slice(0, 300)}`,
    );
  }
  const payload = (await response.json()) as SubmitResult;
  if (!payload.request_id) throw new Error("FAL no devolvió request_id.");
  return payload.request_id;
}

export async function cancelFalJob(
  modelId: string,
  providerRequestId: string,
): Promise<void> {
  if (config.PROCESSING_DRIVER === "fake") return;
  const endpoint = new URL(
    `https://queue.fal.run/${falQueueModelId(modelId)}/requests/${encodeURIComponent(providerRequestId)}/cancel`,
  );
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: { Authorization: `Key ${config.FAL_KEY}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (![202, 400, 404].includes(response.status)) {
    throw new Error(`FAL rechazó la cancelación (${response.status}).`);
  }
}

export async function waitForFalResult(
  modelId: string,
  providerRequestId: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {},
): Promise<unknown> {
  if (!config.FAL_KEY) throw new Error("FAL_KEY no está configurada.");
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  const pollIntervalMs = options.pollIntervalMs ?? 1_000;
  const deadline = Date.now() + timeoutMs;
  const base = `https://queue.fal.run/${falQueueModelId(modelId)}/requests/${encodeURIComponent(providerRequestId)}`;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const status = (await falQueueJson(`${base}/status`)) as QueueStatus;
      if (status.status === "COMPLETED") return falQueueJson(base);
      lastError = undefined;
    } catch (error) {
      if (error instanceof FalQueueError && error.status < 500) throw error;
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  if (lastError instanceof Error) throw lastError;
  throw new Error("FAL no completó el trabajo dentro del tiempo esperado.");
}

export function falQueueModelId(modelId: string): string {
  const [owner, alias] = modelId.split("/");
  if (!owner || !alias)
    throw new Error(`Identificador FAL inválido: ${modelId}`);
  return `${owner}/${alias}`;
}

export function buildFalInput(
  request: ProcessingRequest,
  imageUrl: string,
): Record<string, unknown> {
  const expectedModel = supportedFalModels[request.tool];
  if (request.modelId !== expectedModel) {
    throw new Error(
      `El modelo ${request.modelId} no usa el contrato configurado para ${request.tool}.`,
    );
  }

  const input = request.input;
  if (request.tool === "upscaler") {
    const upscaleMode = input.upscaleMode === "target" ? "target" : "factor";
    return {
      image_url: imageUrl,
      upscale_mode: upscaleMode,
      ...(upscaleMode === "target"
        ? { target_resolution: targetResolutionValue(input.targetResolution) }
        : { upscale_factor: clamp(numberValue(input.scale, 2), 1, 10) }),
      noise_scale: clamp(numberValue(input.fidelity, 0.1), 0, 1),
      output_format:
        request.outputFormat === "jpeg" ? "jpg" : request.outputFormat,
      sync_mode: false,
    };
  }

  if (request.tool === "background_remover") {
    return {
      image_url: imageUrl,
      sync_mode: false,
    };
  }

  return {
    image_url: imageUrl,
    expand_top: nonNegativeInteger(input.expandTop, 256),
    expand_bottom: nonNegativeInteger(input.expandBottom, 256),
    expand_left: nonNegativeInteger(input.expandLeft, 256),
    expand_right: nonNegativeInteger(input.expandRight, 256),
    auto_crop: false,
    mode: input.mode === "fast" ? "fast" : "high",
    enable_safety_checker: true,
    output_format: request.outputFormat === "jpeg" ? "jpeg" : "png",
    sync_mode: false,
  };
}

function numberValue(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function nonNegativeInteger(value: unknown, fallback: number): number {
  return Math.max(0, Math.round(numberValue(value, fallback)));
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function targetResolutionValue(
  value: unknown,
): "720p" | "1080p" | "1440p" | "2160p" {
  return ["720p", "1080p", "1440p", "2160p"].includes(String(value))
    ? (String(value) as "720p" | "1080p" | "1440p" | "2160p")
    : "1080p";
}

async function falQueueJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { Authorization: `Key ${config.FAL_KEY}` },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new FalQueueError(
      `La cola FAL respondió ${response.status}: ${detail.slice(0, 300)}`,
      response.status,
    );
  }
  return response.json();
}
