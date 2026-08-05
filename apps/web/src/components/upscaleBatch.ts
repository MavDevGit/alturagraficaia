import type { Asset } from "../api/client";

export type TargetResolution = "720p" | "1080p" | "1440p" | "2160p";
export type UpscaleMode = "factor" | "resolution";

export type UpscaleConfig = {
  mode: UpscaleMode;
  scale: number;
  targetResolution: TargetResolution;
};

export const defaultUpscaleConfig: UpscaleConfig = {
  mode: "factor",
  scale: 2,
  targetResolution: "1080p",
};

const targetShortSides: Record<TargetResolution, number> = {
  "720p": 720,
  "1080p": 1080,
  "1440p": 1440,
  "2160p": 2160,
};

export function effectiveScaleFor(asset: Asset, config: UpscaleConfig): number {
  if (config.mode === "factor") return clamp(config.scale, 1, 10);
  return (
    targetShortSides[config.targetResolution] /
    Math.max(1, Math.min(asset.width, asset.height))
  );
}

export function upscaleOutputDimensions(asset: Asset, config: UpscaleConfig) {
  const scale = effectiveScaleFor(asset, config);
  return {
    width: Math.ceil((asset.width * scale) / 16) * 16,
    height: Math.ceil((asset.height * scale) / 16) * 16,
  };
}

export function upscaleCredits(asset: Asset, config: UpscaleConfig): number {
  return Math.max(1, Math.ceil(effectiveScaleFor(asset, config) / 2));
}

export function upscaleOptionValue(config: UpscaleConfig): string {
  return config.mode === "factor"
    ? `factor:${config.scale}`
    : `resolution:${config.targetResolution}`;
}

export function parseUpscaleOption(
  value: string,
  current: UpscaleConfig,
): UpscaleConfig {
  const [kind, setting] = value.split(":");
  if (kind === "factor") {
    const scale = Number(setting);
    return {
      ...current,
      mode: "factor",
      scale: Number.isFinite(scale) ? clamp(Math.round(scale), 1, 10) : 2,
    };
  }
  if (
    kind === "resolution" &&
    ["720p", "1080p", "1440p", "2160p"].includes(setting)
  ) {
    return {
      ...current,
      mode: "resolution",
      targetResolution: setting as TargetResolution,
    };
  }
  return current;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
