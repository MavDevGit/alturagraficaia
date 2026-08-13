let tokenProvider: () => Promise<string | null> = async () => null;

export function registerTokenProvider(
  provider: () => Promise<string | null>,
): void {
  tokenProvider = provider;
}

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";
export const AUTH_EXPIRED_EVENT = "altura:auth-expired";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenProvider();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!(init.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");
  const timeout = AbortSignal.timeout(
    init.body instanceof FormData ? 180_000 : 60_000,
  );
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeout])
    : timeout;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers, signal });
  } catch (reason) {
    const message =
      reason instanceof DOMException && reason.name === "TimeoutError"
        ? "La operación tardó demasiado. Compruebe su conexión e intente nuevamente."
        : "No se pudo conectar con el servicio. Compruebe su conexión e intente nuevamente.";
    throw new ApiError(0, message, reason);
  }
  if (!response.ok) {
    const payload = await response
      .json()
      .catch(() => ({ message: "Error de comunicación." }));
    const validationMessage = firstValidationMessage(payload.errors);
    const error = new ApiError(
      response.status,
      validationMessage ??
        payload.message ??
        "La operación no pudo completarse.",
      payload.errors,
    );
    if (response.status === 401)
      window.dispatchEvent(
        new CustomEvent(AUTH_EXPIRED_EVENT, {
          detail: { message: error.message },
        }),
      );
    throw error;
  }
  return response.json() as Promise<T>;
}

function firstValidationMessage(details: unknown): string | undefined {
  if (!details || typeof details !== "object") return undefined;
  for (const value of Object.values(details)) {
    if (typeof value === "string" && value) return value;
    if (Array.isArray(value)) {
      const message = value.find(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.length > 0,
      );
      if (message) return message;
    }
  }
  return undefined;
}

export async function download(path: string, filename: string): Promise<void> {
  const direct = await api<{ url: string; filename?: string }>(path);
  if (!direct.url.startsWith("https://")) {
    throw new ApiError(0, "El resultado no tiene una URL de descarga segura.");
  }

  const picker = (
    window as typeof window & {
      showSaveFilePicker?: (options: {
        suggestedName: string;
      }) => Promise<{ createWritable: () => Promise<WritableStream> }>;
    }
  ).showSaveFilePicker;
  if (!picker) {
    const anchor = document.createElement("a");
    anchor.href = direct.url;
    anchor.download = direct.filename ?? filename;
    anchor.target = "_blank";
    anchor.rel = "noopener";
    anchor.click();
    return;
  }

  try {
    const handle = await picker({ suggestedName: direct.filename ?? filename });
    const response = await fetch(direct.url);
    if (!response.ok || !response.body) {
      throw new ApiError(response.status, "FAL no pudo entregar el archivo.");
    }
    const writable = await handle.createWritable();
    await response.body.pipeTo(writable);
  } catch (reason) {
    if (reason instanceof DOMException && reason.name === "AbortError") return;
    if (reason instanceof ApiError) throw reason;
    throw new ApiError(
      0,
      "No se pudo descargar el archivo. Compruebe su conexión.",
      reason,
    );
  }
}

export async function uploadDirect(
  url: string,
  file: File,
  headers: Record<string, string>,
): Promise<void> {
  if (!url.startsWith("https://")) {
    throw new ApiError(0, "FAL no devolvió una URL de carga segura.");
  }
  let response: Response;
  try {
    response = await fetch(url, { method: "PUT", headers, body: file });
  } catch (reason) {
    throw new ApiError(
      0,
      "No se pudo enviar la imagen directamente a FAL.",
      reason,
    );
  }
  if (!response.ok) {
    throw new ApiError(response.status, "FAL no pudo recibir la imagen completa.");
  }
}

export type Asset = {
  id: string;
  kind: "original" | "result";
  status: "pending" | "ready" | "failed" | "expired";
  width: number;
  height: number;
  mime_type: string;
  byte_size: number;
  viewer_url: string;
  thumbnail_url?: string;
  download_url: string;
  expires_at?: string;
};

export type Job = {
  id: string;
  tool: Tool;
  status:
    "queued" | "processing" | "completed" | "failed" | "cancelled";
  credits: number;
  settings: Record<string, unknown>;
  error: string | null;
  created_at: string;
  source_asset: Asset;
  result_asset: Asset | null;
};

export type Tool = "upscaler" | "background-remover" | "outpainting";

export type ViewerSource = {
  id: string;
  width: number;
  height: number;
  mime_type: string;
  ready: boolean;
  image_url: string;
  token_expires_in: number;
  expires_at: string | null;
};

export type UploadTicket = {
  asset: Asset;
  upload_url: string;
  method: "PUT";
  headers: Record<string, string>;
};

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  credit_balance: number;
  avatar_url: string | null;
};
