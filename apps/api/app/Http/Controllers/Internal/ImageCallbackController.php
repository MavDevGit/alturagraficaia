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
            'status' => ['required', 'in:processing,tiling,ready,failed'],
            'providerRequestId' => ['nullable', 'string', 'max:255'],
            'resultObject' => ['required_if:status,ready', 'nullable', 'string', 'max:1024'],
            'pyramidPrefix' => ['required_if:status,ready', 'nullable', 'string', 'max:1024'],
            'width' => ['required_if:status,ready', 'nullable', 'integer', 'min:1', 'max:'.config('altura.max_output_side')],
            'height' => ['required_if:status,ready', 'nullable', 'integer', 'min:1', 'max:'.config('altura.max_output_side')],
            'maxLevel' => ['required_if:status,ready', 'nullable', 'integer', 'between:0,32'],
            'byteSize' => ['required_if:status,ready', 'nullable', 'integer', 'min:1', 'max:'.config('altura.storage_hard_limit_bytes')],
            'storedBytes' => ['required_if:status,ready', 'nullable', 'integer', 'min:1', 'max:'.config('altura.storage_hard_limit_bytes')],
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
                if (
                    ! $result
                    || $data['resultObject'] !== $result->storage_path
                    || $data['pyramidPrefix'] !== "tiles/{$result->id}"
                    || $data['mimeType'] !== $result->mime_type
                    || config('altura.max_output_pixels') < $data['width'] * $data['height']
                ) {
                    throw ValidationException::withMessages([
                        'resultObject' => 'Los datos del resultado no coinciden con el trabajo reservado.',
                    ]);
                }
                $result->update([
                    'tile_prefix' => $data['pyramidPrefix'],
                    'status' => 'ready',
                    'width' => $data['width'],
                    'height' => $data['height'],
                    'max_level' => $data['maxLevel'],
                    'byte_size' => $data['byteSize'],
                ]);
                $quotas->reconcileAssetStorage($result, $data['storedBytes']);
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
}
