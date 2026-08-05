import type { ViewerSource } from "../api/client";

export type DeepZoomTileSource = {
  width?: number;
  height?: number;
  tileSize?: number;
  tileOverlap?: number;
  minLevel?: number;
  maxLevel?: number;
  getTileUrl?: (level: number, x: number, y: number) => string;
};

export function createTileSource(source: ViewerSource): DeepZoomTileSource {
  if (!source.ready || source.max_level === null) {
    throw new Error("Los mosaicos Deep Zoom todavía no están disponibles.");
  }
  return {
    width: source.width,
    height: source.height,
    tileSize: source.tile_size,
    tileOverlap: source.overlap,
    minLevel: 0,
    maxLevel: source.max_level,
    getTileUrl: (level, x, y) =>
      source.tile_url
        .replace("{level}", String(level))
        .replace("{x}", String(x))
        .replace("{y}", String(y)),
  };
}
