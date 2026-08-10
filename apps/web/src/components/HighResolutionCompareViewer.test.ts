import { describe, expect, it } from "vitest";
import { createTileSource } from "./tileSource";
import type { ViewerSource } from "../api/client";

const source: ViewerSource = {
  id: "result",
  width: 8000,
  height: 3152,
  mime_type: "image/png",
  ready: true,
  image_url: "https://api.test/assets/result/content?token=short",
  token_expires_in: 900,
  expires_at: "2026-08-17T00:00:00Z",
};

describe("full image viewer source", () => {
  it("opens the complete image without building a client-side pyramid", () => {
    expect(createTileSource(source)).toEqual({
      type: "image",
      url: "https://api.test/assets/result/content?token=short",
      buildPyramid: false,
    });
  });

  it("waits until the complete image is ready", () => {
    expect(() => createTileSource({ ...source, ready: false })).toThrow(
      "La imagen completa todavía no está disponible.",
    );
  });
});
