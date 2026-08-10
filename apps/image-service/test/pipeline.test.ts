import { afterAll, describe, expect, it } from "vitest";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";
import { renderFake } from "../src/fake.js";
import type { ProcessingRequest } from "../src/types.js";

function request(width: number, height: number): ProcessingRequest {
  return {
    jobId: "099bc66c-6893-41dc-aeb5-8b0417905f16",
    tool: "upscaler",
    modelId: "fake/model",
    input: { scale: 4 },
    sourceObject: `fixtures/${width}x${height}.png`,
    outputFormat: "png",
    resultExpiresInSeconds: 604_800,
  };
}

describe("image pipeline acceptance dimensions", () => {
  it.each([
    [572, 1024, 2288, 4096],
    [1997, 788, 8000, 3152],
  ])(
    "renders %sx%s as %sx%s",
    async (width, height, expectedWidth, expectedHeight) => {
      const source = await sharp({
        create: { width, height, channels: 3, background: "#d88c6a" },
      })
        .png()
        .toBuffer();
      const result = await renderFake(source, request(width, height));
      const metadata = await sharp(result).metadata();
      expect([metadata.width, metadata.height]).toEqual([
        expectedWidth,
        expectedHeight,
      ]);
    },
    30_000,
  );

  it("renders the SeedVR2 target-resolution mode used in local development", async () => {
    const source = await sharp({
      create: { width: 1600, height: 900, channels: 3, background: "#d88c6a" },
    })
      .png()
      .toBuffer();
    const targetRequest = request(1600, 900);
    targetRequest.input = {
      upscaleMode: "target",
      targetResolution: "1080p",
    };
    const result = await renderFake(source, targetRequest);
    const metadata = await sharp(result).metadata();
    expect([metadata.width, metadata.height]).toEqual([1920, 1088]);
  });

});

afterAll(() =>
  rm(resolve(process.cwd(), "../../storage/image-service"), {
    recursive: true,
    force: true,
  }),
);
