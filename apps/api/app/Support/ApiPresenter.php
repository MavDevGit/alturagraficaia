<?php

namespace App\Support;

use App\Models\Asset;
use App\Models\Job;

class ApiPresenter
{
    /** @return array<string,mixed> */
    public static function asset(Asset $asset): array
    {
        return [
            'id' => $asset->id,
            'kind' => $asset->kind,
            'status' => $asset->status,
            'width' => $asset->width,
            'height' => $asset->height,
            'mime_type' => $asset->mime_type,
            'byte_size' => $asset->byte_size,
            'viewer_url' => route('assets.viewer', $asset),
            'download_url' => route('assets.download', $asset),
            'expires_at' => $asset->expires_at?->toIso8601String(),
        ];
    }

    /** @return array<string,mixed> */
    public static function job(Job $job): array
    {
        $job->loadMissing(['sourceAsset', 'resultAsset']);
        $settings = array_filter(
            $job->settings ?? [],
            fn (string $key): bool => ! str_starts_with($key, '_'),
            ARRAY_FILTER_USE_KEY,
        );

        return [
            'id' => $job->id,
            'tool' => $job->tool,
            'status' => $job->status,
            'credits' => $job->credits,
            'settings' => $settings ?: (object) [],
            'error' => $job->error,
            'created_at' => $job->created_at?->toIso8601String(),
            'finished_at' => $job->finished_at?->toIso8601String(),
            'source_asset' => self::asset($job->sourceAsset),
            'result_asset' => $job->resultAsset ? self::asset($job->resultAsset) : null,
        ];
    }
}
