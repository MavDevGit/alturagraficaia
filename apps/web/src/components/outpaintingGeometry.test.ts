import { describe, expect, it } from "vitest";
import type { Asset } from "../api/client";
import {
  centeredMargins,
  changeMargin,
  defaultOutpaintingMargins,
  outpaintingDimensions,
  outpaintingMargins,
} from "./outpaintingGeometry";

const asset = {
  id: "asset",
  kind: "original",
  status: "ready",
  width: 1061,
  height: 405,
  mime_type: "image/jpeg",
  byte_size: 1024,
  viewer_url: "",
  download_url: "",
} satisfies Asset;

describe("outpainting geometry", () => {
  it("calculates centered aspect-ratio presets without cropping", () => {
    const square = outpaintingMargins(asset, "square", {
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
    });
    expect(outpaintingDimensions(asset, square)).toEqual({
      width: 1061,
      height: 1061,
    });
    expect(Math.abs(square.top - square.bottom)).toBeLessThanOrEqual(1);

    const landscape = outpaintingMargins(asset, "landscape", square);
    expect(outpaintingDimensions(asset, landscape)).toEqual({
      width: 1061,
      height: 597,
    });
  });

  it("suggests visible, symmetric margins for a newly uploaded image", () => {
    expect(defaultOutpaintingMargins(asset)).toEqual({
      left: 64,
      right: 64,
      top: 64,
      bottom: 64,
    });
  });

  it("keeps drag operations pixel-precise and preserves size when centering", () => {
    const changed = changeMargin(
      { left: 64, right: 64, top: 32, bottom: 96 },
      "left",
      39,
    );
    expect(changed.left).toBe(103);
    expect(centeredMargins(changed)).toEqual({
      left: 83,
      right: 84,
      top: 64,
      bottom: 64,
    });
  });
});
