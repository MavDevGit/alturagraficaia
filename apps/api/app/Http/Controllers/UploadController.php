<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Services\QuotaService;
use App\Support\ApiPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use League\Flysystem\UnableToWriteFile;
use RuntimeException;
use Symfony\Component\HttpKernel\Exception\ServiceUnavailableHttpException;
use Throwable;

class UploadController extends Controller
{
    public function __invoke(Request $request, QuotaService $quotas): JsonResponse
    {
        $request->validate(
            ['file' => [
                'required',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:'.config('altura.max_upload_kb'),
            ]],
            [
                'file.required' => 'Selecciona una imagen para cargar.',
                'file.uploaded' => 'No se pudo recibir el archivo completo. Comprueba que no supere 50 MB e inténtalo nuevamente.',
                'file.image' => 'El archivo seleccionado no es una imagen válida.',
                'file.mimes' => 'La imagen debe estar en formato PNG, JPG o WebP.',
                'file.max' => 'La imagen no puede superar 50 MB.',
            ],
        );
        $file = $request->file('file');
        $dimensions = @getimagesize($file->getRealPath());
        if (! $dimensions) {
            throw ValidationException::withMessages(['file' => 'No se pudo leer la imagen.']);
        }
        [$width, $height] = $dimensions;
        if (
            $width > config('altura.max_input_side')
            || $height > config('altura.max_input_side')
            || $width * $height > config('altura.max_input_pixels')
        ) {
            throw ValidationException::withMessages([
                'file' => 'La imagen supera el límite seguro de dimensiones o píxeles.',
            ]);
        }

        $id = (string) Str::uuid();
        $extension = strtolower($file->extension() ?: 'bin');
        $path = "assets/{$request->user()->id}/{$id}/original.{$extension}";
        $disk = config('filesystems.default');
        $fileBytes = (int) $file->getSize();
        $quotaBytes = $quotas->estimateOriginal($width, $height, $fileBytes);
        $quotas->reserveStorage($quotaBytes);
        try {
            try {
                $stored = Storage::disk($disk)->putFileAs(dirname($path), $file, basename($path));
            } catch (UnableToWriteFile $error) {
                throw new ServiceUnavailableHttpException(
                    30,
                    'No se pudo guardar la imagen en el almacenamiento temporal. Intenta nuevamente.',
                    $error,
                );
            }
            if ($stored === false) {
                throw new RuntimeException('No se pudo almacenar la imagen original.');
            }
            $asset = Asset::query()->create([
                'id' => $id,
                'user_id' => $request->user()->id,
                'kind' => 'original',
                'status' => 'ready',
                'storage_disk' => $disk,
                'storage_path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getMimeType() ?: 'application/octet-stream',
                'byte_size' => $fileBytes,
                'quota_bytes' => $quotaBytes,
                'width' => $width,
                'height' => $height,
                'expires_at' => now()->addDays(config('altura.asset_ttl_days')),
            ]);
        } catch (Throwable $error) {
            Storage::disk($disk)->delete($path);
            $quotas->releaseStorage($quotaBytes);
            throw $error;
        }

        return response()->json(ApiPresenter::asset($asset), 201);
    }
}
