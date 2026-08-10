<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Models\Job;
use App\Services\CreditService;
use App\Services\QuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ImageCallbackController extends Controller
{
    public function __invoke(Request $request, CreditService $credits, QuotaService $quotas): JsonResponse
    {
        $body = $request->getContent();
        $expected = hash_hmac('sha256', $body, config('altura.callback_secret'));
        abort_unless(hash_equals($expected, (string) $request->header('X-Altura-Signature')), 401);
        $data = $request->validate([
            'jobId' => ['required', 'uuid'],
            'status' => ['required', 'in:processing,ready,failed'],
            'providerRequestId' => ['nullable', 'string', 'max:255'],
            'resultUrl' => ['required_if:status,ready', 'nullable', 'url', 'max:4096'],
            'width' => ['nullable', 'integer', 'min:1', 'max:'.config('altura.max_output_side')],
            'height' => ['nullable', 'integer', 'min:1', 'max:'.config('altura.max_output_side')],
            'byteSize' => ['nullable', 'integer', 'min:1'],
            'mimeType' => ['required_if:status,ready', 'nullable', 'in:image/png,image/jpeg,image/webp'],
            'error' => ['nullable', 'string', 'max:2000'],
        ]);

        DB::transaction(function () use ($data, $credits, $quotas): void {
            $job = Job::query()->with('resultAsset')->lockForUpdate()->findOrFail($data['jobId']);
            if (in_array($job->status, ['completed', 'failed', 'cancelled'], true)) {
                return;
            }
            if (
                $job->provider_job_id
                && isset($data['providerRequestId'])
                && $job->provider_job_id !== $data['providerRequestId']
            ) {
                throw ValidationException::withMessages([
                    'providerRequestId' => 'El identificador del proveedor no coincide con el trabajo.',
                ]);
            }

            if ($data['status'] === 'failed') {
                $job->update([
                    'status' => 'failed',
                    'error' => $data['error'] ?? 'Falló el procesamiento.',
                    'finished_at' => now(),
                ]);
                $credits->refund($job, 'El proveedor no pudo completar el trabajo.');
                if ($job->resultAsset) {
                    $quotas->releaseAsset($job->resultAsset);
                    $job->resultAsset->update(['status' => 'failed']);
                }
            } elseif ($data['status'] === 'ready') {
                $result = $job->resultAsset;
                $width = $data['width'] ?? $result?->width;
                $height = $data['height'] ?? $result?->height;
                if (
                    ! $result
                    || ! $this->isAllowedResultUrl($data['resultUrl'])
                    || $data['mimeType'] !== $result->mime_type
                    || ! $width
                    || ! $height
                    || config('altura.max_output_pixels') < $width * $height
                ) {
                    throw ValidationException::withMessages([
                        'resultUrl' => 'Los datos del resultado no coinciden con el trabajo reservado.',
                    ]);
                }
                $result->update([
                    'external_url' => $data['resultUrl'],
                    'status' => 'ready',
                    'width' => $width,
                    'height' => $height,
                    'byte_size' => $data['byteSize'] ?? 0,
                ]);
                $job->update([
                    'status' => 'completed',
                    'provider_job_id' => $data['providerRequestId'] ?? $job->provider_job_id,
                    'finished_at' => now(),
                ]);
                $credits->confirm($job);
            } else {
                $job->update([
                    'status' => $data['status'],
                    'provider_job_id' => $data['providerRequestId'] ?? $job->provider_job_id,
                ]);
            }
            $job->events()->create(['type' => $data['status'], 'payload' => $data, 'created_at' => now()]);
        }, 3);

        return response()->json(['accepted' => true]);
    }

    private function isAllowedResultUrl(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        if (
            app()->environment(['local', 'testing'])
            && $scheme === 'http'
            && in_array($host, ['127.0.0.1', 'localhost'], true)
        ) {
            return true;
        }

        return $scheme === 'https' && ($host === 'fal.media'
            || str_ends_with($host, '.fal.media')
            || $host === 'storage.googleapis.com');
    }
}
