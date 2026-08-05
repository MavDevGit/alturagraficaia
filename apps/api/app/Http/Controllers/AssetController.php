<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Services\AssetAccessToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AssetController extends Controller
{
    public function viewer(Request $request, Asset $asset, AssetAccessToken $tokens): JsonResponse
    {
        $this->authorizeAsset($request, $asset);
        $ttl = config('altura.asset_viewer_token_ttl');
        $token = $tokens->issue($asset, $ttl);

        return response()->json([
            'id' => $asset->id,
            'width' => $asset->width,
            'height' => $asset->height,
            'tile_size' => $asset->tile_size,
            'overlap' => $asset->overlap,
            'format' => 'webp',
            'max_level' => $asset->max_level,
            'ready' => $asset->status === 'ready' && $asset->tile_prefix !== null,
            'tile_url' => str_replace(
                ['LEVELTOKEN', 'XTOKEN', 'YTOKEN'],
                ['{level}', '{x}', '{y}'],
                route('assets.tile', ['asset' => $asset, 'level' => 'LEVELTOKEN', 'tile' => 'XTOKEN_YTOKEN.webp', 'token' => $token]),
            ),
            'token_expires_in' => $ttl,
        ]);
    }

    public function tile(Request $request, Asset $asset, int $level, string $tile, AssetAccessToken $tokens): Response
    {
        abort_unless($tokens->valid($asset, $request->query('token')), 401);
        abort_unless((bool) preg_match('/^\d+_\d+\.webp$/', $tile), 404);
        abort_unless($asset->tile_prefix, 404);
        $disk = Storage::disk($asset->storage_disk);
        $canonicalPath = "{$asset->tile_prefix}/image_files/{$level}/{$tile}";
        if ($asset->storage_disk === 'gcs') {
            return redirect()->away($disk->temporaryUrl($canonicalPath, now()->addMinutes(15)), 302, [
                'Cache-Control' => 'private, no-store',
            ]);
        }
        $path = collect([
            $canonicalPath,
            "{$asset->tile_prefix}/image.dzi_files/{$level}/{$tile}",
        ])->first(fn (string $candidate): bool => $disk->exists($candidate));
        abort_unless($path, 404);

        return $disk->response($path, null, [
            'Content-Type' => 'image/webp',
            'Cache-Control' => 'private, max-age=900',
        ]);
    }

    public function download(Request $request, Asset $asset): Response
    {
        $this->authorizeAsset($request, $asset);
        $name = $asset->kind === 'result' ? 'altura-grafica-ia-'.$asset->id.'.'.pathinfo($asset->storage_path, PATHINFO_EXTENSION) : $asset->original_name;

        $disk = Storage::disk($asset->storage_disk);
        if ($asset->storage_disk === 'gcs') {
            $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename((string) $name)) ?: 'download';
            return redirect()->away($disk->temporaryUrl($asset->storage_path, now()->addMinutes(10), [
                'gcp_signing_options' => ['responseDisposition' => 'attachment; filename="'.$safeName.'"'],
            ]), 302, ['Cache-Control' => 'private, no-store']);
        }

        return $disk->download($asset->storage_path, $name);
    }

    private function authorizeAsset(Request $request, Asset $asset): void
    {
        abort_unless($asset->user_id === $request->user()->id || $request->user()->isAdmin(), 404);
    }
}
