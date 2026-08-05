import type { Asset } from "../api/client";

export type CanvasMode = "manual" | "square" | "landscape" | "portrait";
export type MarginSide = "left" | "right" | "top" | "bottom";
export type Margins = Record<MarginSide, number>;

export const emptyMargins: Margins = {
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
};

export const maximumMargin = 2048;
export const marginStep = 16;

export function defaultOutpaintingMargins(asset: Asset): Margins {
  const suggested = clamp(
    roundToStep(Math.min(asset.width, asset.height) * 0.16),
    64,
    512,
  );
  return {
    left: suggested,
    right: suggested,
    top: suggested,
    bottom: suggested,
  };
}

export function outpaintingMargins(
  asset: Asset,
  mode: CanvasMode,
  manualMargins: Margins,
): Margins {
  if (mode === "manual") return sanitizeMargins(manualMargins);

  let targetWidth = asset.width;
  let targetHeight = asset.height;
  if (mode === "square") {
    targetWidth = targetHeight = Math.max(asset.width, asset.height);
  } else {
    const ratio = mode === "portrait" ? 9 / 16 : 16 / 9;
    if (asset.width / asset.height < ratio) {
      targetWidth = Math.ceil(asset.height * ratio);
    } else {
      targetHeight = Math.ceil(asset.width / ratio);
    }
  }

  const horizontal = Math.max(0, targetWidth - asset.width);
  const vertical = Math.max(0, targetHeight - asset.height);
  return {
    left: Math.floor(horizontal / 2),
    right: Math.ceil(horizontal / 2),
    top: Math.floor(vertical / 2),
    bottom: Math.ceil(vertical / 2),
  };
}

export function outpaintingDimensions(asset: Asset, margins: Margins) {
  return {
    width: asset.width + margins.left + margins.right,
    height: asset.height + margins.top + margins.bottom,
  };
}

export function changeMargin(
  margins: Margins,
  side: MarginSide,
  delta: number,
): Margins {
  return {
    ...margins,
    [side]: clamp(Math.round(margins[side] + delta), 0, maximumMargin),
  };
}

export function centeredMargins(margins: Margins): Margins {
  const horizontal = margins.left + margins.right;
  const vertical = margins.top + margins.bottom;
  return {
    left: Math.floor(horizontal / 2),
    right: Math.ceil(horizontal / 2),
    top: Math.floor(vertical / 2),
    bottom: Math.ceil(vertical / 2),
  };
}

export function sanitizeMargins(margins: Margins): Margins {
  return {
    left: clamp(Math.round(margins.left), 0, maximumMargin),
    right: clamp(Math.round(margins.right), 0, maximumMargin),
    top: clamp(Math.round(margins.top), 0, maximumMargin),
    bottom: clamp(Math.round(margins.bottom), 0, maximumMargin),
  };
}

function roundToStep(value: number): number {
  return Math.round(value / marginStep) * marginStep;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
