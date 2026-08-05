import { describe, expect, it } from "vitest";
import { createTileSource } from "./tileSource";
import type { ViewerSource } from "../api/client";

const source: ViewerSource = {
  id: "result",
  width: 8000,
  height: 3152,
  tile_size: 512,
  overlap: 1,
  format: "webp",
  max_level: 13,
  ready: true,
  tile_url:
    "https://api.test/assets/result/tiles/{level}/{x}_{y}.webp?token=short",
};

describe("Deep Zoom tile source", () => {
  it("requests a visible lossless tile and never the complete image when ready", () => {
    const built = createTileSource(source) as {
      getTileUrl(level: number, x: number, y: number): string;
      tileSize: number;
      tileOverlap: number;
    };
    expect(built.getTileUrl(13, 2, 1)).toBe(
      "https://api.test/assets/result/tiles/13/2_1.webp?token=short",
    );
    expect(built.tileSize).toBe(512);
    expect(built.tileOverlap).toBe(1);
    expect(JSON.stringify(built)).not.toContain("/content");
  });

  it("refuses to decode the complete image while tiles are pending", () => {
    expect(() => createTileSource({ ...source, ready: false })).toThrow(
      "Los mosaicos Deep Zoom todavía no están disponibles.",
    );
  });
});
