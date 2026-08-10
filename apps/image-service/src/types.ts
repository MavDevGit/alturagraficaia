import { z } from "zod";

const objectNameSchema = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (value) =>
      !value.startsWith("/") &&
      !value.includes("\\") &&
      !value.includes("\0") &&
      !value.split("/").includes(".."),
    "La ruta del objeto no es válida.",
  );

export const toolSchema = z.enum([
  "upscaler",
  "background_remover",
  "outpainting",
]);

export const processingRequestSchema = z.object({
  jobId: z.string().uuid(),
  tool: toolSchema,
  modelId: z
    .string()
    .min(3)
    .max(255)
    .regex(/^[a-zA-Z0-9._/-]+$/),
  input: z.record(z.string(), z.unknown()),
  sourceObject: objectNameSchema,
  outputFormat: z.enum(["png", "jpeg", "webp"]).default("png"),
  resultExpiresInSeconds: z.number().int().min(60).max(2_592_000).default(604_800),
  expectedWidth: z.number().int().positive().optional(),
  expectedHeight: z.number().int().positive().optional(),
});

export type ProcessingRequest = z.infer<typeof processingRequestSchema>;

export type ProcessingCallback = {
  jobId: string;
  status: "processing" | "ready" | "failed";
  providerRequestId?: string;
  resultUrl?: string;
  width?: number;
  height?: number;
  byteSize?: number;
  mimeType?: string;
  error?: string;
};

export const falFinalizeRequestSchema = z.object({
  jobId: z.string().uuid(),
  requestId: z.string().min(1).max(255),
  status: z.enum(["OK", "ERROR"]),
  payload: z.unknown().optional(),
  error: z.string().max(2000).nullish(),
});

export type FalFinalizeRequest = z.infer<typeof falFinalizeRequestSchema>;
