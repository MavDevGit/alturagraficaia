<?php

namespace App\Http\Controllers;

use App\Jobs\ProcessImageJob;
use App\Models\Asset;
use App\Models\Job;
use App\Models\ToolSetting;
use App\Services\CreditService;
use App\Services\ImageServiceClient;
use App\Services\QuotaService;
use App\Support\ApiPresenter;
use App\Support\UpscaleGeometry;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class JobController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $jobs = Job::query()->whereBelongsTo($request->user())->latest()->with(['sourceAsset', 'resultAsset'])->paginate(20);

        return response()->json([
            'data' => collect($jobs->items())->map(fn (Job $job) => ApiPresenter::job($job)),
            'meta' => ['current_page' => $jobs->currentPage(), 'last_page' => $jobs->lastPage(), 'total' => $jobs->total()],
        ]);
    }

    public function store(Request $request, CreditService $credits, QuotaService $quotas): JsonResponse
    {
        $data = $request->validate([
            'tool' => ['required', Rule::in(['upscaler', 'background-remover', 'outpainting'])],
            'source_asset_id' => ['required', 'uuid'],
            'settings' => ['sometimes', 'array:upscaleMode,scale,targetResolution,format,fidelity,mode,expandTop,expandBottom,expandLeft,expandRight'],
            'settings.upscaleMode' => ['sometimes', Rule::in(['factor', 'target'])],
            'settings.scale' => ['sometimes', 'numeric', 'between:1,10'],
            'settings.targetResolution' => ['sometimes', Rule::in(['720p', '1080p', '1440p', '2160p'])],
            'settings.format' => ['sometimes', Rule::in(['png', 'jpeg', 'webp'])],
            'settings.fidelity' => ['sometimes', 'numeric', 'between:0,1'],
            'settings.mode' => ['sometimes', Rule::in(['high', 'fast'])],
            'settings.expandTop' => ['sometimes', 'integer', 'between:0,4096'],
            'settings.expandBottom' => ['sometimes', 'integer', 'between:0,4096'],
            'settings.expandLeft' => ['sometimes', 'integer', 'between:0,4096'],
            'settings.expandRight' => ['sometimes', 'integer', 'between:0,4096'],
        ]);
        $this->validateToolSettings($data['tool'], $data['settings'] ?? []);
        $source = Asset::query()->whereBelongsTo($request->user())->findOrFail($data['source_asset_id']);
        if ($source->kind !== 'original' || in_array($source->status, ['expired', 'failed'], true)) {
            throw ValidationException::withMessages(['source_asset_id' => 'La imagen original ya no está disponible.']);
        }
        $this->validateOutputDimensions($source, $data['tool'], $data['settings'] ?? []);
        if ($data['tool'] === 'upscaler' && ($data['settings']['format'] ?? 'png') === 'webp') {
            $dimensions = UpscaleGeometry::outputDimensions($source->width, $source->height, $data['settings'] ?? []);
            if ($dimensions['width'] > 16383 || $dimensions['height'] > 16383) {
                throw ValidationException::withMessages(['settings.format' => 'WebP admite como máximo 16.383 píxeles por lado; seleccione PNG.']);
            }
        }
        if ($data['tool'] === 'background-remover' && ($data['settings']['format'] ?? 'png') !== 'png') {
            throw ValidationException::withMessages(['settings.format' => 'Bria RMBG 2.0 devuelve una imagen PNG transparente.']);
        }
        if ($data['tool'] === 'outpainting' && ($data['settings']['format'] ?? 'png') === 'webp') {
            throw ValidationException::withMessages(['settings.format' => 'FLUX.2 Pro Outpaint admite salidas PNG o JPG.']);
        }
        $cost = $this->cost($data['tool'], $data['settings'] ?? [], $source);
        $extension = $data['settings']['format'] ?? 'png';
        $mime = $extension === 'jpeg' ? 'image/jpeg' : "image/{$extension}";
        $quotaBytes = $quotas->estimateResult($source, $data['tool'], $data['settings'] ?? []);

        $job = DB::transaction(function () use ($request, $source, $data, $cost, $extension, $mime, $credits, $quotas, $quotaBytes): Job {
            $quotas->reserveStorage($quotaBytes);
            $quotas->reserveImageJob();
            $quotas->reserveResultPyramidOperations($source, $data['tool'], $data['settings'] ?? []);
            $result = Asset::query()->create([
                'id' => (string) Str::uuid(), 'user_id' => $request->user()->id, 'kind' => 'result',
                'status' => 'pending', 'storage_disk' => config('filesystems.default'),
                'storage_path' => "assets/{$request->user()->id}/results/".Str::uuid().".{$extension}",
                'mime_type' => $mime, 'byte_size' => 0, 'quota_bytes' => $quotaBytes,
                'width' => $source->width, 'height' => $source->height,
                'expires_at' => now()->addDays(config('altura.asset_ttl_days')),
            ]);
            $job = Job::query()->create([
                'user_id' => $request->user()->id, 'source_asset_id' => $source->id, 'result_asset_id' => $result->id,
                'tool' => $data['tool'], 'status' => 'queued', 'credits' => $cost, 'settings' => $data['settings'] ?? [],
            ]);
            $credits->reserve($request->user(), $job, $cost);
            $job->events()->create(['type' => 'queued', 'payload' => ['credits' => $cost], 'created_at' => now()]);

            return $job;
        });

        ProcessImageJob::dispatch($job->id);

        return response()->json(ApiPresenter::job($job), 201);
    }

    public function show(Request $request, Job $job): JsonResponse
    {
        abort_unless($job->user_id === $request->user()->id || $request->user()->isAdmin(), 404);

        return response()->json(ApiPresenter::job($job));
    }

    public function cancel(Request $request, Job $job, CreditService $credits, QuotaService $quotas, ImageServiceClient $images): JsonResponse
    {
        abort_unless($job->user_id === $request->user()->id || $request->user()->isAdmin(), 404);
        $shouldCancelProvider = false;
        DB::transaction(function () use ($job, $credits, $quotas, &$shouldCancelProvider): void {
            $locked = Job::query()->with('resultAsset')->lockForUpdate()->findOrFail($job->id);
            if (in_array($locked->status, ['queued', 'processing'], true)) {
                $locked->update(['status' => 'cancelled', 'finished_at' => now()]);
                $credits->refund($locked, 'Trabajo cancelado por el usuario.');
                if ($locked->resultAsset) {
                    $quotas->releaseAsset($locked->resultAsset);
                }
                $locked->events()->create(['type' => 'cancelled', 'created_at' => now()]);
                $shouldCancelProvider = (bool) $locked->provider_job_id;
            }
        }, 3);

        $fresh = $job->fresh();
        if ($shouldCancelProvider && $fresh) {
            try {
                $images->cancel($fresh);
            } catch (Throwable $error) {
                report($error);
                $fresh->events()->create([
                    'type' => 'provider_cancel_failed',
                    'payload' => ['error' => $error->getMessage()],
                    'created_at' => now(),
                ]);
            }
        }

        return response()->json(ApiPresenter::job($fresh));
    }

    /** @param array<string,mixed> $settings */
    private function validateToolSettings(string $tool, array $settings): void
    {
        $allowed = match ($tool) {
            'upscaler' => ['upscaleMode', 'scale', 'targetResolution', 'format', 'fidelity'],
            'background-remover' => ['format'],
            'outpainting' => ['format', 'mode', 'expandTop', 'expandBottom', 'expandLeft', 'expandRight'],
        };
        $unsupported = array_diff(array_keys($settings), $allowed);
        if ($unsupported !== []) {
            throw ValidationException::withMessages([
                'settings' => 'Parámetros no compatibles con esta herramienta: '.implode(', ', $unsupported).'.',
            ]);
        }

        if ($tool === 'upscaler') {
            $mode = $settings['upscaleMode'] ?? 'factor';
            if ($mode === 'target' && array_key_exists('scale', $settings)) {
                throw ValidationException::withMessages(['settings.scale' => 'El factor no se usa en el modo de resolución objetivo.']);
            }
            if ($mode === 'factor' && array_key_exists('targetResolution', $settings)) {
                throw ValidationException::withMessages(['settings.targetResolution' => 'La resolución objetivo sólo se usa en ese modo.']);
            }
        }
    }

    /** @param array<string,mixed> $settings */
    private function cost(string $tool, array $settings, Asset $source): int
    {
        $configured = ToolSetting::query()->where('tool', $tool)->where('enabled', true)->first();
        if (! $configured) {
            throw ValidationException::withMessages(['tool' => 'La herramienta no está disponible.']);
        }
        if ($tool !== 'upscaler') {
            return $configured->base_credits;
        }

        $scale = UpscaleGeometry::effectiveScale($source->width, $source->height, $settings);

        return max($configured->base_credits, (int) ceil($scale / 2));
    }

    /** @param array<string,mixed> $settings */
    private function validateOutputDimensions(Asset $source, string $tool, array $settings): void
    {
        if ($tool === 'upscaler') {
            ['width' => $width, 'height' => $height] = UpscaleGeometry::outputDimensions(
                $source->width,
                $source->height,
                $settings,
            );
        } elseif ($tool === 'outpainting') {
            $width = $source->width + (int) ($settings['expandLeft'] ?? 0) + (int) ($settings['expandRight'] ?? 0);
            $height = $source->height + (int) ($settings['expandTop'] ?? 0) + (int) ($settings['expandBottom'] ?? 0);
        } else {
            $width = $source->width;
            $height = $source->height;
        }

        if (
            $width > config('altura.max_output_side')
            || $height > config('altura.max_output_side')
            || $width * $height > config('altura.max_output_pixels')
        ) {
            throw ValidationException::withMessages([
                'settings' => 'La configuración produciría una imagen demasiado grande para procesarla de forma segura.',
            ]);
        }
    }
}
