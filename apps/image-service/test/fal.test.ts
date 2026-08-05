import { describe, expect, it } from "vitest";
import {
  buildFalInput,
  falQueueModelId,
  supportedFalModels,
} from "../src/fal.js";
import type { ProcessingRequest } from "../src/types.js";

function request(overrides: Partial<ProcessingRequest>): ProcessingRequest {
  const tool = overrides.tool ?? "upscaler";
  return {
    jobId: "099bc66c-6893-41dc-aeb5-8b0417905f16",
    tool,
    modelId: supportedFalModels[tool],
    input: {},
    sourceObject: "private/original.png",
    sourcePyramidPrefix: "tiles/source",
    resultObject: "private/result.png",
    resultPyramidPrefix: "tiles/result",
    outputFormat: "png",
    ...overrides,
  };
}

describe("FAL input adapter", () => {
  it("maps the upscaler UI settings to SeedVR2's official schema", () => {
    expect(
      buildFalInput(
        request({ input: { scale: 4, fidelity: 0.25 }, outputFormat: "jpeg" }),
        "https://signed.example/original",
      ),
    ).toMatchObject({
      image_url: "https://signed.example/original",
      upscale_mode: "factor",
      upscale_factor: 4,
      noise_scale: 0.25,
      output_format: "jpg",
    });
  });

  it("uses SeedVR2 target-resolution presets without sending a factor", () => {
    expect(
      buildFalInput(
        request({
          input: {
            upscaleMode: "target",
            targetResolution: "2160p",
            fidelity: 0.4,
          },
        }),
        "https://signed.example/original",
      ),
    ).toEqual({
      image_url: "https://signed.example/original",
      upscale_mode: "target",
      target_resolution: "2160p",
      noise_scale: 0.4,
      output_format: "png",
      sync_mode: false,
    });
  });

  it("always gives background removal an alpha-capable format", () => {
    expect(
      buildFalInput(
        request({ tool: "background_remover", outputFormat: "jpeg" }),
        "data:image/png;base64,abc",
      ),
    ).toEqual({
      image_url: "data:image/png;base64,abc",
      sync_mode: false,
    });
  });

  it("provides useful outpainting expansion defaults", () => {
    expect(
      buildFalInput(
        request({ tool: "outpainting", outputFormat: "webp" }),
        "https://signed.example/original",
      ),
    ).toMatchObject({
      expand_top: 256,
      expand_bottom: 256,
      expand_left: 256,
      expand_right: 256,
      auto_crop: false,
      mode: "high",
      enable_safety_checker: true,
      output_format: "png",
      sync_mode: false,
    });
  });

  it("forwards the fast outpainting mode selected in the UI", () => {
    expect(
      buildFalInput(
        request({ tool: "outpainting", input: { mode: "fast" } }),
        "https://signed.example/original",
      ),
    ).toMatchObject({ mode: "fast" });
  });

  it("rejects a model whose schema does not match the selected tool", () => {
    expect(() =>
      buildFalInput(
        request({ tool: "background_remover", modelId: "fal-ai/birefnet" }),
        "https://signed.example/original",
      ),
    ).toThrow(/no usa el contrato configurado/);
  });

  it("uses the canonical queue application id for nested model endpoints", () => {
    expect(falQueueModelId("fal-ai/seedvr/upscale/image")).toBe(
      "fal-ai/seedvr",
    );
    expect(falQueueModelId("fal-ai/flux-2-pro/outpaint")).toBe(
      "fal-ai/flux-2-pro",
    );
  });
});
