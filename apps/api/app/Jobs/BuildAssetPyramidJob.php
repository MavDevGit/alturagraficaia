<?php

namespace App\Jobs;

use App\Models\Asset;
use App\Services\ImageServiceClient;
use App\Services\QuotaService;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Throwable;

class BuildAssetPyramidJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public int $timeout = 950;

    public function __construct(public readonly string $assetId) {}

    public function handle(ImageServiceClient $images, QuotaService $quotas): void
    {
        $asset = Asset::query()->findOrFail($this->assetId);
        $manifest = $images->pyramid($asset);
        $asset->update([
            'tile_prefix' => "tiles/{$asset->id}",
            'tile_size' => $manifest['tileSize'],
            'overlap' => $manifest['overlap'],
            'max_level' => $manifest['maxLevel'],
            'status' => 'ready',
        ]);
        $quotas->reconcileAssetStorage($asset, $asset->byte_size + (int) $manifest['storedBytes']);
    }

    public function failed(Throwable $error): void
    {
        $asset = Asset::query()->whereKey($this->assetId)->where('status', 'pending')->first();
        if (! $asset) {
            return;
        }

        $claimed = Asset::query()->whereKey($asset->id)->where('status', 'pending')->update([
            'status' => 'failed',
        ]);
        if ($claimed !== 1) {
            return;
        }

        try {
            Storage::disk($asset->storage_disk)->delete($asset->storage_path);
            Storage::disk($asset->storage_disk)->deleteDirectory("tiles/{$asset->id}");
        } catch (Throwable $cleanupError) {
            report($cleanupError);
        }

        $quotas = app(QuotaService::class);
        $quotas->releaseAsset($asset);
        $quotas->releasePyramidOperations($asset->width, $asset->height);
    }
}
