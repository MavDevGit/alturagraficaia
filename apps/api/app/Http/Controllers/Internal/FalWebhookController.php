<?php

namespace App\Http\Controllers\Internal;

use App\Http\Controllers\Controller;
use App\Models\Job;
use App\Services\CreditService;
use App\Services\FalClient;
use App\Services\FalWebhookVerifier;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class FalWebhookController extends Controller
{
    public function __invoke(
        Request $request,
        FalWebhookVerifier $verifier,
        FalClient $fal,
        CreditService $credits,
    ): JsonResponse {
        $rawBody = $request->getContent();
        abort_unless($verifier->valid($request, $rawBody), 401);
        $data = $request->validate([
            'request_id' => ['required', 'string', 'max:255'],
            'status' => ['required', 'in:OK,ERROR'],
            'payload' => ['nullable'],
            'error' => ['nullable', 'string', 'max:2000'],
            'payload_error' => ['nullable', 'string', 'max:2000'],
        ]);
        $jobId = $request->query('job_id');
        abort_unless(is_string($jobId) && preg_match('/^[0-9a-f-]{36}$/i', $jobId), 422);

        DB::transaction(function () use ($jobId, $data, $fal, $credits): void {
            $job = Job::query()->with('resultAsset')->lockForUpdate()->findOrFail($jobId);
            if (in_array($job->status, ['completed', 'failed', 'cancelled'], true)) {
                return;
            }
            if (! $job->provider_job_id) {
                $job->update(['provider_job_id' => $data['request_id']]);
            } elseif (! hash_equals($job->provider_job_id, $data['request_id'])) {
                throw ValidationException::withMessages([
                    'request_id' => 'El webhook no corresponde al trabajo enviado a FAL.',
                ]);
            }

            if ($data['status'] === 'ERROR') {
                $message = $data['error'] ?? $data['payload_error'] ?? 'FAL no pudo completar el trabajo.';
                $job->update(['status' => 'failed', 'error' => $message, 'finished_at' => now()]);
                $job->resultAsset?->update(['status' => 'failed']);
                $credits->refund($job, 'FAL no pudo completar el trabajo.');
                $job->events()->create(['type' => 'failed', 'payload' => $data, 'created_at' => now()]);

                return;
            }

            $result = $this->findImageResult($data['payload'] ?? null, $fal);
            if (! $result || ! $job->resultAsset) {
                throw ValidationException::withMessages([
                    'payload' => 'FAL no devolvió una imagen permitida.',
                ]);
            }
            $width = $result['width'] ?? $job->resultAsset->width;
            $height = $result['height'] ?? $job->resultAsset->height;
            if (
                $width > config('altura.max_output_side')
                || $height > config('altura.max_output_side')
                || $width * $height > config('altura.max_output_pixels')
            ) {
                throw ValidationException::withMessages(['payload' => 'El resultado excede las dimensiones permitidas.']);
            }
            $mimeType = in_array($result['mime_type'] ?? null, ['image/png', 'image/jpeg', 'image/webp'], true)
                ? $result['mime_type']
                : $job->resultAsset->mime_type;
            $job->resultAsset->update([
                'external_url' => $result['url'],
                'status' => 'ready',
                'width' => $width,
                'height' => $height,
                'byte_size' => $result['byte_size'] ?? 0,
                'mime_type' => $mimeType,
            ]);
            $job->update(['status' => 'completed', 'finished_at' => now()]);
            $credits->confirm($job);
            $job->events()->create(['type' => 'ready', 'payload' => $data, 'created_at' => now()]);
        }, 3);

        return response()->json(['accepted' => true]);
    }

    /** @return array{url:string,width?:int,height?:int,byte_size?:int,mime_type?:string}|null */
    private function findImageResult(mixed $value, FalClient $fal): ?array
    {
        if (is_array($value)) {
            $url = $value['url'] ?? $value['image_url'] ?? null;
            if (is_string($url) && $fal->isMediaUrl($url)) {
                return array_filter([
                    'url' => $url,
                    'width' => $this->positiveInt($value['width'] ?? null),
                    'height' => $this->positiveInt($value['height'] ?? null),
                    'byte_size' => $this->positiveInt($value['file_size'] ?? $value['byte_size'] ?? $value['size'] ?? null),
                    'mime_type' => is_string($value['content_type'] ?? $value['mime_type'] ?? null)
                        ? ($value['content_type'] ?? $value['mime_type'])
                        : null,
                ], fn (mixed $item): bool => $item !== null);
            }
            foreach (['image', 'images', 'output', 'result', 'data'] as $key) {
                if (array_key_exists($key, $value) && ($found = $this->findImageResult($value[$key], $fal))) {
                    return $found;
                }
            }
            foreach ($value as $nested) {
                if ($found = $this->findImageResult($nested, $fal)) {
                    return $found;
                }
            }
        }

        return null;
    }

    private function positiveInt(mixed $value): ?int
    {
        return is_int($value) && $value > 0 ? $value : null;
    }
}
