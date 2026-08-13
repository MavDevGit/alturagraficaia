<?php

namespace App\Http\Controllers;

use App\Models\Asset;
use App\Services\AssetAccessToken;
use App\Services\FalProxyClient;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
            'ready' => $asset->status === 'ready' && $asset->external_url !== null,
            'image_url' => route('assets.content', ['asset' => $asset, 'token' => $token]),
            'token_expires_in' => $ttl,
            'expires_at' => $asset->expires_at?->toIso8601String(),
        ]);
    }

    public function content(Request $request, Asset $asset, AssetAccessToken $tokens): Response
    {
        abort_unless($tokens->valid($asset, $request->query('token')), 401);
        abort_unless($asset->status === 'ready', 404);
        abort_unless($asset->external_url, 404);

        return redirect()->away($asset->external_url, 302, ['Cache-Control' => 'private, no-store']);
    }

    public function thumbnail(
        Request $request,
        Asset $asset,
        AssetAccessToken $tokens,
        FalProxyClient $proxy,
    ): Response {
        abort_unless($tokens->valid($asset, $request->query('token'), 'thumbnail'), 401);
        abort_unless($asset->status === 'ready' && $asset->external_url, 404);

        $thumbnailUrl = $proxy->thumbnailUrl(
            $asset->external_url,
            config('altura.asset_thumbnail_token_ttl'),
        );
        abort_unless($thumbnailUrl, 503);

        return redirect()->away($thumbnailUrl, 302, ['Cache-Control' => 'private, no-store']);
    }

    public function download(Request $request, Asset $asset): JsonResponse
    {
        $this->authorizeAsset($request, $asset);
        abort_unless($asset->status === 'ready', 404);
        abort_unless($asset->external_url, 404);
        $extension = match ($asset->mime_type) {
            'image/jpeg' => 'jpg',
            'image/webp' => 'webp',
            default => 'png',
        };
        $filename = $asset->kind === 'result'
            ? "altura-grafica-ia-{$asset->id}.{$extension}"
            : ($asset->original_name ?: "altura-{$asset->id}.{$extension}");

        return response()->json([
            'url' => $asset->external_url,
            'filename' => $filename,
        ], headers: ['Cache-Control' => 'private, no-store']);
    }

    private function authorizeAsset(Request $request, Asset $asset): void
    {
        abort_unless($asset->user_id === $request->user()->id || $request->user()->isAdmin(), 404);
    }
}
