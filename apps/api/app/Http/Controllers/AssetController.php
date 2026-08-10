<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Services\AssetAccessToken;
use App\Services\QuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

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
            'mime_type' => $asset->mime_type,
            'ready' => $asset->status === 'ready' && ($asset->external_url !== null || $asset->storage_path !== ''),
            'image_url' => route('assets.content', ['asset' => $asset, 'token' => $token]),
            'token_expires_in' => $ttl,
            'expires_at' => $asset->expires_at?->toIso8601String(),
        ]);
    }

    public function content(Request $request, Asset $asset, AssetAccessToken $tokens, QuotaService $quotas): Response
    {
        abort_unless($tokens->valid($asset, $request->query('token')), 401);
        abort_unless($asset->status === 'ready', 404);
        if ($asset->external_url) {
            return redirect()->away($asset->external_url, 302, ['Cache-Control' => 'private, no-store']);
        }

        $disk = Storage::disk($asset->storage_disk);
        if ($asset->storage_disk === 'gcs') {
            $quotas->reserveGcsRead(max(1, $asset->byte_size));

            return redirect()->away($disk->temporaryUrl($asset->storage_path, now()->addSeconds(config('altura.gcs_signed_url_ttl_seconds'))), 302, [
                'Cache-Control' => 'private, no-store',
            ]);
        }

        abort_unless($disk->exists($asset->storage_path), 404);

        return $disk->response($asset->storage_path, null, [
            'Content-Type' => $asset->mime_type,
            'Cache-Control' => 'private, max-age=900',
        ]);
    }

    public function download(Request $request, Asset $asset, QuotaService $quotas): Response
    {
        $this->authorizeAsset($request, $asset);
        abort_unless($asset->status === 'ready', 404);
        if ($asset->external_url) {
            return redirect()->away($asset->external_url, 302, ['Cache-Control' => 'private, no-store']);
        }
        $name = $asset->kind === 'result' ? 'altura-grafica-ia-'.$asset->id.'.'.pathinfo($asset->storage_path, PATHINFO_EXTENSION) : $asset->original_name;

        $disk = Storage::disk($asset->storage_disk);
        if ($asset->storage_disk === 'gcs') {
            $quotas->reserveGcsRead(max(1, $asset->byte_size));
            $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename((string) $name)) ?: 'download';

            return redirect()->away($disk->temporaryUrl($asset->storage_path, now()->addSeconds(config('altura.gcs_signed_url_ttl_seconds')), [
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
