<?php

namespace App\Support;

final class UpscaleGeometry
{
    /** @param array<string,mixed> $settings */
    public static function effectiveScale(int $width, int $height, array $settings): float
    {
        if (($settings['upscaleMode'] ?? 'factor') !== 'target') {
            return (float) ($settings['scale'] ?? 2);
        }

        $targetShortSide = match ($settings['targetResolution'] ?? '1080p') {
            '720p' => 720,
            '1440p' => 1440,
            '2160p' => 2160,
            default => 1080,
        };
        $shortSide = max(1, min($width, $height));

        return $targetShortSide / $shortSide;
    }

    /** @param array<string,mixed> $settings
     *  @return array{width:int,height:int}
     */
    public static function outputDimensions(int $width, int $height, array $settings): array
    {
        $scale = self::effectiveScale($width, $height, $settings);

        return [
            'width' => (int) (ceil(($width * $scale) / 16) * 16),
            'height' => (int) (ceil(($height * $scale) / 16) * 16),
        ];
    }
}
