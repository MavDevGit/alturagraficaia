<?php

namespace App\Jobs;

use App\Models\Job;
use App\Services\CreditService;
use App\Services\ImageServiceClient;
use App\Services\QuotaService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ProcessImageJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 2;

    public int $timeout = 180;

    public function __construct(public readonly string $jobId) {}

    public function handle(ImageServiceClient $images): void
    {
        $job = Job::query()->findOrFail($this->jobId);
        if ($job->status === 'cancelled' && $job->provider_job_id) {
            $images->cancel($job);

            return;
        }
        if (! in_array($job->status, ['queued', 'processing'], true) || $job->provider_job_id) {
            return;
        }
        if ($job->status === 'queued') {
            $job->update(['status' => 'processing', 'started_at' => now()]);
            $job->events()->create(['type' => 'processing', 'created_at' => now()]);
        }
        $providerRequestId = $images->submit($job);
        $job->refresh();
        $job->update(['provider_job_id' => $providerRequestId]);
        if ($job->status === 'cancelled') {
            $images->cancel($job);
        }
    }

    public function failed(Throwable $error): void
    {
        $job = Job::query()->find($this->jobId);
        if (! $job || in_array($job->status, ['completed', 'cancelled'], true)) {
            return;
        }
        $job->update(['status' => 'failed', 'error' => $error->getMessage(), 'finished_at' => now()]);
        app(CreditService::class)->refund($job, 'El servicio de imágenes no pudo iniciar el trabajo.');
        if ($job->resultAsset) {
            app(QuotaService::class)->releaseAsset($job->resultAsset);
        }
    }
}
