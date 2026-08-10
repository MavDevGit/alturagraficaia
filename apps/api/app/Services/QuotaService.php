<?php

namespace App\Services;

use App\Models\Asset;
use App\Models\UsageQuota;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class QuotaService
{
    public const STORAGE = 'storage_bytes';

    public const IMAGE_JOBS = 'image_jobs';

    public const GCS_CLASS_A = 'gcs_class_a_operations';

    public const GCS_CLASS_B = 'gcs_class_b_operations';

    public const GCS_EGRESS = 'gcs_egress_bytes';

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

    public function reserveGcsRead(int $bytes): void
    {
        DB::transaction(function () use ($bytes): void {
            $this->reserveWithinTransaction(
                self::GCS_CLASS_B,
                1,
                config('altura.gcs_class_b_soft_limit'),
                config('altura.gcs_class_b_hard_limit'),
            );
            $this->reserveWithinTransaction(
                self::GCS_EGRESS,
                max(1, $bytes),
                config('altura.gcs_egress_soft_limit_bytes'),
                config('altura.gcs_egress_hard_limit_bytes'),
            );
        }, 3);
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

    public function estimateOriginal(int $width, int $height, int $fileBytes): int
    {
        return $fileBytes;
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

}
