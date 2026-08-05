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
    const error = new ApiError(
      response.status,
      payload.message ?? "La operación no pudo completarse.",
      payload.errors,
    );
    if (response.status === 401)
      window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
    throw error;
  }
  return response.json() as Promise<T>;
}

export async function download(path: string, filename: string): Promise<void> {
  const token = await tokenProvider();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(180_000),
    });
  } catch (reason) {
    throw new ApiError(
      0,
      "No se pudo descargar el archivo. Compruebe su conexión.",
      reason,
    );
  }
  if (!response.ok)
    throw new ApiError(response.status, "No se pudo descargar el archivo.");
  const url = URL.createObjectURL(await response.blob());
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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
  download_url: string;
  expires_at?: string;
};

export type Job = {
  id: string;
  tool: Tool;
  status:
    "queued" | "processing" | "tiling" | "completed" | "failed" | "cancelled";
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
  tile_size: number;
  overlap: number;
  format: "webp";
  max_level: number | null;
  ready: boolean;
  tile_url: string;
};

export type CurrentUser = {
  id: string;
  name: string | null;
  email: string;
  role: "user" | "admin";
  credit_balance: number;
  avatar_url: string | null;
};
