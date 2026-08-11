<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Services\FalClient;
use App\Support\ApiPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Throwable;

class UploadController extends Controller
{
    public function initiate(Request $request, FalClient $fal): JsonResponse
    {
        $data = $request->validate([
            'file_name' => ['required', 'string', 'max:255'],
            'mime_type' => ['required', Rule::in(['image/png', 'image/jpeg', 'image/webp'])],
            'byte_size' => ['required', 'integer', 'min:1', 'max:'.(config('altura.max_upload_kb') * 1024)],
            'width' => ['required', 'integer', 'min:1', 'max:'.config('altura.max_input_side')],
            'height' => ['required', 'integer', 'min:1', 'max:'.config('altura.max_input_side')],
        ]);
        if ($data['width'] * $data['height'] > config('altura.max_input_pixels')) {
            throw ValidationException::withMessages([
                'width' => 'La imagen supera el límite seguro de píxeles para procesamiento.',
            ]);
        }

        $id = (string) Str::uuid();
        $extension = match ($data['mime_type']) {
            'image/jpeg' => 'jpg',
            'image/webp' => 'webp',
            default => 'png',
        };
        try {
            $ticket = $fal->initiateUpload("{$id}.{$extension}", $data['mime_type']);
        } catch (Throwable $error) {
            report($error);

            return response()->json([
                'message' => 'FAL no está disponible temporalmente. No se cargó la imagen ni se descontaron créditos.',
            ], 503);
        }
        $asset = Asset::query()->create([
            'id' => $id,
            'user_id' => $request->user()->id,
            'kind' => 'original',
            'status' => 'pending',
            'external_url' => $ticket['file_url'],
            'original_name' => basename($data['file_name']),
            'mime_type' => $data['mime_type'],
            'byte_size' => $data['byte_size'],
            'width' => $data['width'],
            'height' => $data['height'],
            'expires_at' => now()->addDays(config('altura.asset_ttl_days')),
        ]);

        return response()->json([
            'asset' => ApiPresenter::asset($asset),
            'upload_url' => $ticket['upload_url'],
            'method' => 'PUT',
            'headers' => ['Content-Type' => $data['mime_type']],
        ], 201);
    }

    public function complete(Request $request, Asset $asset, FalClient $fal): JsonResponse
    {
        abort_unless($asset->user_id === $request->user()->id || $request->user()->isAdmin(), 404);
        if ($asset->kind !== 'original' || ! in_array($asset->status, ['pending', 'ready'], true)) {
            throw ValidationException::withMessages(['asset' => 'La carga no puede completarse.']);
        }
        if ($asset->status === 'ready') {
            return response()->json(ApiPresenter::asset($asset));
        }
        if (! $asset->external_url || ! $fal->isMediaUrl($asset->external_url)) {
            throw ValidationException::withMessages(['asset' => 'La URL temporal de carga no es válida.']);
        }

        $probe = Http::connectTimeout(5)->timeout(15)->head($asset->external_url);
        if (! $probe->successful()) {
            throw ValidationException::withMessages([
                'asset' => 'FAL todavía no confirma la carga completa del archivo.',
            ]);
        }
        $actualBytes = (int) ($probe->header('Content-Length') ?: $asset->byte_size);
        $asset->update(['status' => 'ready', 'byte_size' => max(1, $actualBytes)]);

        return response()->json(ApiPresenter::asset($asset->fresh()));
    }
}
