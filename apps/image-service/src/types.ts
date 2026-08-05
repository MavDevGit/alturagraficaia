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
  sourcePyramidPrefix: objectNameSchema,
  resultObject: objectNameSchema,
  resultPyramidPrefix: objectNameSchema,
  outputFormat: z.enum(["png", "jpeg", "webp"]).default("png"),
});

export type ProcessingRequest = z.infer<typeof processingRequestSchema>;

export const pyramidRequestSchema = z.object({
  jobId: z.string().uuid(),
  assetId: z.string().uuid(),
  source: objectNameSchema,
  destinationPrefix: objectNameSchema,
});

export type PyramidRequest = z.infer<typeof pyramidRequestSchema>;

export type PyramidManifest = {
  width: number;
  height: number;
  tileSize: 512;
  overlap: 1;
  format: "webp";
  maxLevel: number;
  descriptor: string;
  storedBytes: number;
  objectCount: number;
};

export type ProcessingCallback = {
  jobId: string;
  status: "processing" | "tiling" | "ready" | "failed";
  providerRequestId?: string;
  resultObject?: string;
  pyramidPrefix?: string;
  width?: number;
  height?: number;
  maxLevel?: number;
  byteSize?: number;
  storedBytes?: number;
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
