<?php

use App\Support\UpscaleGeometry;

it('calculates SeedVR2 factor and target-resolution geometry', function (): void {
    expect(UpscaleGeometry::outputDimensions(1600, 900, [
        'upscaleMode' => 'factor',
        'scale' => 2,
    ]))->toBe(['width' => 3200, 'height' => 1808])
        ->and(UpscaleGeometry::outputDimensions(1600, 900, [
            'upscaleMode' => 'target',
            'targetResolution' => '1080p',
        ]))->toBe(['width' => 1920, 'height' => 1088])
        ->and(UpscaleGeometry::effectiveScale(100, 100, [
            'upscaleMode' => 'target',
            'targetResolution' => '2160p',
        ]))->toBe(21.6);
});
