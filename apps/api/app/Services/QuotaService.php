<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\UsageQuota;
use App\Support\UpscaleGeometry;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class QuotaService
{
    public const STORAGE = 'storage_bytes';

    public const IMAGE_JOBS = 'image_jobs';

    public const GCS_CLASS_A = 'gcs_class_a_operations';

    public function reserveStorage(int $bytes): void
    {
        $this->reserve(
            self::STORAGE,
            $bytes,
            config('altura.storage_soft_limit_bytes'),
            config('altura.storage_hard_limit_bytes'),
        );
    }

    public function reserveImageJob(): void
    {
        $this->reserve(
            self::IMAGE_JOBS,
            1,
            config('altura.image_jobs_soft_limit'),
            config('altura.image_jobs_hard_limit'),
        );
    }

    public function reservePyramidOperations(int $width, int $height): void
    {
        $this->reserve(
            self::GCS_CLASS_A,
            $this->estimatePyramidObjects($width, $height),
            config('altura.gcs_class_a_soft_limit'),
            config('altura.gcs_class_a_hard_limit'),
        );
    }

    /** @param array<string,mixed> $settings */
    public function reserveResultPyramidOperations(Asset $source, string $tool, array $settings): void
    {
        ['width' => $width, 'height' => $height] = $this->resultDimensions($source, $tool, $settings);
        $this->reservePyramidOperations($width, $height);
    }

    public function releasePyramidOperations(int $width, int $height): void
    {
        DB::transaction(
            fn () => $this->release(self::GCS_CLASS_A, $this->estimatePyramidObjects($width, $height)),
            3,
        );
    }

    public function releaseStorage(int $bytes): void
    {
        DB::transaction(fn () => $this->release(self::STORAGE, $bytes), 3);
    }

    public function releaseAsset(Asset $asset): void
    {
        DB::transaction(function () use ($asset): void {
            $locked = Asset::query()->lockForUpdate()->find($asset->id);
            if (! $locked || $locked->quota_bytes <= 0) {
                return;
            }
            $this->release(self::STORAGE, $locked->quota_bytes);
            $locked->update(['quota_bytes' => 0]);
        }, 3);
    }

    public function reconcileAssetStorage(Asset $asset, int $actualBytes): void
    {
        DB::transaction(function () use ($asset, $actualBytes): void {
            $locked = Asset::query()->lockForUpdate()->findOrFail($asset->id);
            $actualBytes = max(0, $actualBytes);
            $delta = $actualBytes - $locked->quota_bytes;
            if ($delta > 0) {
                $this->reserveWithinTransaction(
                    self::STORAGE,
                    $delta,
                    config('altura.storage_soft_limit_bytes'),
                    config('altura.storage_hard_limit_bytes'),
                );
            } elseif ($delta < 0) {
                $this->release(self::STORAGE, abs($delta));
            }
            $locked->update(['quota_bytes' => $actualBytes]);
        }, 3);
    }

    public function estimateOriginal(int $width, int $height, int $fileBytes): int
    {
        return $fileBytes + (int) ceil($width * $height * 6.0);
    }

    /** @param array<string,mixed> $settings */
    public function estimateResult(Asset $source, string $tool, array $settings): int
    {
        ['width' => $width, 'height' => $height] = $this->resultDimensions($source, $tool, $settings);

        return (int) ceil($width * $height * 6.0);
    }

    /** @param array<string,mixed> $settings */
    public function estimateResultPyramidObjects(Asset $source, string $tool, array $settings): int
    {
        ['width' => $width, 'height' => $height] = $this->resultDimensions($source, $tool, $settings);

        return $this->estimatePyramidObjects($width, $height);
    }

    public function estimatePyramidObjects(int $width, int $height, int $tileSize = 512): int
    {
        $maxLevel = (int) ceil(log(max($width, $height), 2));
        $objects = 1; // descriptor DZI
        for ($level = 0; $level <= $maxLevel; $level++) {
            $scale = 2 ** ($maxLevel - $level);
            $objects += (int) ceil($width / $scale / $tileSize)
                * (int) ceil($height / $scale / $tileSize);
        }

        return $objects;
    }

    /** @return array<int,UsageQuota> */
    public function current(): array
    {
        return UsageQuota::query()
            ->where(function ($query): void {
                $query->where(function ($storage): void {
                    $storage->where('resource', self::STORAGE)->whereDate('period_start', '1970-01-01');
                })->orWhere(function ($monthly): void {
                    $monthly->where('resource', '!=', self::STORAGE)
                        ->whereDate('period_start', now()->startOfMonth());
                });
            })
            ->orderBy('resource')->get()->all();
    }

    private function reserve(string $resource, int $amount, int $softLimit, int $hardLimit): void
    {
        if ($amount <= 0) {
            return;
        }

        DB::transaction(
            fn () => $this->reserveWithinTransaction($resource, $amount, $softLimit, $hardLimit),
            3,
        );
    }

    private function reserveWithinTransaction(string $resource, int $amount, int $softLimit, int $hardLimit): void
    {
        $period = $this->periodFor($resource);
        $existing = UsageQuota::query()
            ->where('resource', $resource)
            ->whereDate('period_start', $period)
            ->first();
        if (! $existing) {
            $existing = UsageQuota::query()->create([
                'resource' => $resource,
                'period_start' => $period,
                'used' => 0,
                'soft_limit' => $softLimit,
                'hard_limit' => $hardLimit,
            ]);
        }
        $quota = UsageQuota::query()->lockForUpdate()->findOrFail($existing->id);
        if ($quota->used + $amount > $hardLimit) {
            throw ValidationException::withMessages([
                'quota' => "El límite de {$resource} está por alcanzarse. No se inició la operación.",
            ]);
        }
        if ($quota->used < $softLimit && $quota->used + $amount >= $softLimit) {
            Log::warning('Se alcanzó el umbral preventivo de cuota.', [
                'resource' => $resource,
                'used' => $quota->used + $amount,
                'soft_limit' => $softLimit,
                'hard_limit' => $hardLimit,
            ]);
        }
        $quota->update([
            'used' => $quota->used + $amount,
            'soft_limit' => $softLimit,
            'hard_limit' => $hardLimit,
        ]);
    }

    private function release(string $resource, int $amount): void
    {
        $period = $this->periodFor($resource);
        $quota = UsageQuota::query()->where('resource', $resource)->whereDate('period_start', $period)->lockForUpdate()->first();
        if ($quota) {
            $quota->update(['used' => max(0, $quota->used - $amount)]);
        }
    }

    private function periodFor(string $resource): string
    {
        return $resource === self::STORAGE ? '1970-01-01' : now()->startOfMonth()->toDateString();
    }

    /** @param array<string,mixed> $settings
     *  @return array{width:int,height:int}
     */
    private function resultDimensions(Asset $source, string $tool, array $settings): array
    {
        if ($tool === 'upscaler') {
            return UpscaleGeometry::outputDimensions($source->width, $source->height, $settings);
        }
        if ($tool === 'outpainting') {
            return [
                'width' => $source->width + (int) ($settings['expandLeft'] ?? 0) + (int) ($settings['expandRight'] ?? 0),
                'height' => $source->height + (int) ($settings['expandTop'] ?? 0) + (int) ($settings['expandBottom'] ?? 0),
            ];
        }

        return ['width' => $source->width, 'height' => $source->height];
    }
}
