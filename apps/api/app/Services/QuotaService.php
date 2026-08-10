<?php

namespace App\Services;

use App\Models\UsageQuota;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class QuotaService
{
    public const IMAGE_JOBS = 'image_jobs';

    public function reserveImageJob(): void
    {
        DB::transaction(function (): void {
            $period = now()->startOfMonth()->toDateString();
            $existing = UsageQuota::query()
                ->where('resource', self::IMAGE_JOBS)
                ->whereDate('period_start', $period)
                ->first();
            if (! $existing) {
                $existing = UsageQuota::query()->create([
                    'resource' => self::IMAGE_JOBS,
                    'period_start' => $period,
                    'used' => 0,
                    'soft_limit' => config('altura.image_jobs_soft_limit'),
                    'hard_limit' => config('altura.image_jobs_hard_limit'),
                ]);
            }
            $quota = UsageQuota::query()->lockForUpdate()->findOrFail($existing->id);
            $softLimit = config('altura.image_jobs_soft_limit');
            $hardLimit = config('altura.image_jobs_hard_limit');
            if ($quota->used + 1 > $hardLimit) {
                throw ValidationException::withMessages([
                    'quota' => 'El límite mensual de trabajos de imagen está por alcanzarse.',
                ]);
            }
            if ($quota->used < $softLimit && $quota->used + 1 >= $softLimit) {
                Log::warning('Se alcanzó el umbral preventivo de trabajos de imagen.', [
                    'used' => $quota->used + 1,
                    'soft_limit' => $softLimit,
                    'hard_limit' => $hardLimit,
                ]);
            }
            $quota->update([
                'used' => $quota->used + 1,
                'soft_limit' => $softLimit,
                'hard_limit' => $hardLimit,
            ]);
        }, 3);
    }

    /** @return array<int,UsageQuota> */
    public function current(): array
    {
        return UsageQuota::query()
            ->where('resource', self::IMAGE_JOBS)
            ->whereDate('period_start', now()->startOfMonth())
            ->get()->all();
    }
}
