import { describe, expect, it } from "vitest";
import type { Asset } from "../api/client";
import {
  effectiveScaleFor,
  parseUpscaleOption,
  upscaleCredits,
  upscaleOutputDimensions,
  upscaleOptionValue,
  type UpscaleConfig,
} from "./upscaleBatch";

const asset = {
  id: "asset",
  kind: "original",
  status: "ready",
  width: 500,
  height: 281,
  mime_type: "image/jpeg",
  byte_size: 1024,
  viewer_url: "",
  download_url: "",
} satisfies Asset;

describe("upscale batch configuration", () => {
  it("keeps a factor selection independent and calculates its output", () => {
    const config: UpscaleConfig = {
      mode: "factor",
      scale: 3,
      targetResolution: "1080p",
    };
    expect(effectiveScaleFor(asset, config)).toBe(3);
    expect(upscaleOutputDimensions(asset, config)).toEqual({
      width: 1504,
      height: 848,
    });
    expect(upscaleCredits(asset, config)).toBe(2);
    expect(upscaleOptionValue(config)).toBe("factor:3");
  });

  it("supports independent target resolutions", () => {
    const current: UpscaleConfig = {
      mode: "factor",
      scale: 2,
      targetResolution: "1080p",
    };
    const target = parseUpscaleOption("resolution:1440p", current);
    expect(target).toEqual({
      mode: "resolution",
      scale: 2,
      targetResolution: "1440p",
    });
    expect(effectiveScaleFor(asset, target)).toBeCloseTo(1440 / 281);
    expect(upscaleCredits(asset, target)).toBe(3);
  });

  it("clamps malformed factor options safely", () => {
    const current: UpscaleConfig = {
      mode: "factor",
      scale: 2,
      targetResolution: "1080p",
    };
    expect(parseUpscaleOption("factor:99", current).scale).toBe(10);
    expect(parseUpscaleOption("unknown:value", current)).toEqual(current);
  });
});
