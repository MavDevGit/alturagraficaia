import { config } from "./config.js";
import { signCallback } from "./security.js";
import type { ProcessingCallback } from "./types.js";

export async function notifyApi(payload: ProcessingCallback): Promise<void> {
  if (!config.CALLBACK_URL) return;
  const body = JSON.stringify(payload);
  const response = await fetch(config.CALLBACK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Altura-Signature": signCallback(body, config.CALLBACK_SIGNING_SECRET),
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok)
    throw new Error(`El callback de Laravel respondió ${response.status}.`);
}
