import type { ViewerSource } from "../api/client";

export type FullImageSource = {
  type: "image";
  url: string;
  buildPyramid: false;
};

export function createTileSource(source: ViewerSource): FullImageSource {
  if (!source.ready || !source.image_url) {
    throw new Error("La imagen completa todavía no está disponible.");
  }
  return {
    type: "image",
    url: source.image_url,
    buildPyramid: false,
  };
}
