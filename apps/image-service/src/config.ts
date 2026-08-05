import { resolve } from "node:path";
import "dotenv/config";
import { z } from "zod";

const schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8787),
    HOST: z.string().min(1).optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    SERVICE_MODE: z.enum(["all", "webhook", "worker"]).default("all"),
    PROCESSING_DRIVER: z.enum(["fake", "fal"]).default("fake"),
    FAL_KEY: z.string().default(""),
    FAL_WEBHOOK_URL: z.string().url().optional(),
    CALLBACK_URL: z.string().url().optional(),
    CALLBACK_SIGNING_SECRET: z.string().min(8).default("change-me-locally"),
    INTERNAL_API_KEY: z.string().min(8).default("change-me-locally"),
    GCS_BUCKET: z.string().default(""),
    GCP_PROJECT_ID: z.string().default("altura-grafica-ia"),
    TASKS_LOCATION: z.string().default("us-central1"),
    TASKS_QUEUE: z.string().default(""),
    FINALIZE_URL: z.string().url().optional(),
    FINALIZE_AUDIENCE: z.string().url().optional(),
    TASKS_INVOKER_SERVICE_ACCOUNT: z.string().email().optional(),
    LOCAL_STORAGE_PATH: z.string().default("../../storage/image-service"),
    MAX_REMOTE_BYTES: z.coerce.number().int().positive().default(536_870_912),
    TILE_UPLOAD_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(6),
    TILE_WEBP_QUALITY: z.coerce.number().int().min(70).max(100).default(88),
  })
  .superRefine((value, context) => {
    if (value.NODE_ENV !== "production") return;
    const secretIsUnsafe = (secret: string) =>
      secret.length < 32 || secret.includes("change-me");
    if (value.SERVICE_MODE === "all") {
      context.addIssue({
        code: "custom",
        path: ["SERVICE_MODE"],
        message: "Producción requiere separar SERVICE_MODE=webhook o worker.",
      });
    }
    if (value.SERVICE_MODE === "worker" && value.PROCESSING_DRIVER !== "fal") {
      context.addIssue({
        code: "custom",
        path: ["PROCESSING_DRIVER"],
        message: "Producción requiere PROCESSING_DRIVER=fal.",
      });
    }
    if (value.SERVICE_MODE === "worker" && !value.FAL_KEY) {
      context.addIssue({
        code: "custom",
        path: ["FAL_KEY"],
        message: "FAL_KEY es obligatorio en producción.",
      });
    }
    const requiredSecrets = value.SERVICE_MODE === "worker"
      ? [["CALLBACK_SIGNING_SECRET", value.CALLBACK_SIGNING_SECRET], ["INTERNAL_API_KEY", value.INTERNAL_API_KEY]] as const
      : [["INTERNAL_API_KEY", value.INTERNAL_API_KEY]] as const;
    for (const [name, secret] of requiredSecrets) {
      if (secretIsUnsafe(secret))
        context.addIssue({
          code: "custom",
          path: [name],
          message: `${name} debe tener al menos 32 caracteres.`,
        });
    }
    const requiredUrls = value.SERVICE_MODE === "worker"
      ? [["FAL_WEBHOOK_URL", value.FAL_WEBHOOK_URL], ["CALLBACK_URL", value.CALLBACK_URL]] as const
      : [] as const;
    for (const [name, url] of requiredUrls) {
      if (!url || new URL(url).protocol !== "https:")
        context.addIssue({
          code: "custom",
          path: [name],
          message: `${name} debe usar HTTPS en producción.`,
        });
    }
    if (!value.GCS_BUCKET) {
      context.addIssue({
        code: "custom",
        path: ["GCS_BUCKET"],
        message: "GCS_BUCKET es obligatorio en producción.",
      });
    }
    if (value.SERVICE_MODE === "webhook" && !value.TASKS_QUEUE) {
      context.addIssue({
        code: "custom",
        path: ["TASKS_QUEUE"],
        message: "TASKS_QUEUE es obligatorio en producción.",
      });
    }
    if (
      value.SERVICE_MODE === "webhook" && (!value.FINALIZE_URL ||
      new URL(value.FINALIZE_URL).protocol !== "https:"
      )
    ) {
      context.addIssue({
        code: "custom",
        path: ["FINALIZE_URL"],
        message: "FINALIZE_URL debe usar HTTPS en producción.",
      });
    }
    if (value.SERVICE_MODE === "webhook" && !value.FINALIZE_AUDIENCE) {
      context.addIssue({ code: "custom", path: ["FINALIZE_AUDIENCE"], message: "FINALIZE_AUDIENCE es obligatorio para OIDC." });
    }
    if (value.SERVICE_MODE === "webhook" && !value.TASKS_INVOKER_SERVICE_ACCOUNT) {
      context.addIssue({ code: "custom", path: ["TASKS_INVOKER_SERVICE_ACCOUNT"], message: "La cuenta OIDC de Cloud Tasks es obligatoria." });
    }
  });

const parsed = schema.parse(process.env);

export const config = {
  ...parsed,
  host:
    parsed.HOST ??
    (parsed.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  localStoragePath: resolve(process.cwd(), parsed.LOCAL_STORAGE_PATH),
  isProduction: parsed.NODE_ENV === "production",
};
