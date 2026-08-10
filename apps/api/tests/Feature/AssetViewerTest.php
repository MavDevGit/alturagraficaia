<?php

use App\Models\Asset;
use App\Models\UsageQuota;
use App\Models\User;
use App\Services\QuotaService;
use Illuminate\Support\Facades\Storage;

it('returns a tokenized visible-tile template instead of the complete image', function (): void {
    config()->set('altura.auth_driver', 'local');
    Storage::fake('local');
    $user = User::factory()->create(['firebase_uid' => 'viewer-user']);
    $asset = Asset::query()->create([
        'user_id' => $user->id, 'kind' => 'result', 'status' => 'ready', 'storage_disk' => 'local',
        'storage_path' => 'assets/result.png', 'tile_prefix' => 'tiles/result', 'mime_type' => 'image/png',
        'byte_size' => 2048, 'width' => 8000, 'height' => 3152, 'max_level' => 13,
    ]);
    Storage::disk('local')->put('tiles/result/image_files/13/0_0.webp', 'tile-data');

    $payload = $this->getJson("/api/v1/assets/{$asset->id}/viewer", ['Authorization' => 'Bearer local:viewer-user'])
        ->assertOk()->assertJsonPath('tile_size', 512)->assertJsonPath('overlap', 1)->json();
    expect($payload['tile_url'])->toContain('/tiles/{level}/{x}_{y}.webp')->not->toContain('/download');

    $tileUrl = str_replace(['{level}', '{x}', '{y}'], ['13', '0', '0'], $payload['tile_url']);
    $this->get($tileUrl)->assertOk()->assertHeader('Content-Type', 'image/webp');
});

it('continues serving pyramids created with the legacy sharp directory name', function (): void {
    config()->set('altura.auth_driver', 'local');
    Storage::fake('local');
    $user = User::factory()->create(['firebase_uid' => 'legacy-viewer-user']);
    $asset = Asset::query()->create([
        'user_id' => $user->id, 'kind' => 'result', 'status' => 'ready', 'storage_disk' => 'local',
        'storage_path' => 'assets/result.png', 'tile_prefix' => 'tiles/legacy', 'mime_type' => 'image/png',
        'byte_size' => 2048, 'width' => 1008, 'height' => 576, 'max_level' => 10,
    ]);
    Storage::disk('local')->put('tiles/legacy/image.dzi_files/10/0_0.webp', 'legacy-tile');

    $payload = $this->getJson("/api/v1/assets/{$asset->id}/viewer", ['Authorization' => 'Bearer local:legacy-viewer-user'])
        ->assertOk()->json();
    $tileUrl = str_replace(['{level}', '{x}', '{y}'], ['10', '0', '0'], $payload['tile_url']);
    $this->get($tileUrl)->assertOk()->assertHeader('Content-Type', 'image/webp');
});

it('reserves Class B and egress quotas atomically for GCS reads', function (): void {
    config()->set([
        'altura.gcs_class_b_soft_limit' => 10,
        'altura.gcs_class_b_hard_limit' => 20,
        'altura.gcs_egress_soft_limit_bytes' => 10_000_000,
        'altura.gcs_egress_hard_limit_bytes' => 20_000_000,
    ]);

    app(QuotaService::class)->reserveGcsRead(1_048_576);

    expect(UsageQuota::query()->where('resource', QuotaService::GCS_CLASS_B)->value('used'))->toBe(1)
        ->and(UsageQuota::query()->where('resource', QuotaService::GCS_EGRESS)->value('used'))->toBe(1_048_576);
});

it('rejects a GCS tile before signing when the monthly read limit is reached', function (): void {
    config()->set([
        'altura.auth_driver' => 'local',
        'altura.gcs_class_b_soft_limit' => 0,
        'altura.gcs_class_b_hard_limit' => 0,
    ]);
    $user = User::factory()->create(['firebase_uid' => 'quota-tile-user']);
    $asset = Asset::query()->create([
        'user_id' => $user->id, 'kind' => 'result', 'status' => 'ready', 'storage_disk' => 'gcs',
        'storage_path' => 'assets/result.png', 'tile_prefix' => 'tiles/result', 'mime_type' => 'image/png',
        'byte_size' => 2048, 'width' => 1024, 'height' => 1024, 'max_level' => 10,
    ]);
    $payload = $this->getJson("/api/v1/assets/{$asset->id}/viewer", ['Authorization' => 'Bearer local:quota-tile-user'])
        ->assertOk()->json();
    $tileUrl = str_replace(['{level}', '{x}', '{y}'], ['10', '0', '0'], $payload['tile_url']);

    $this->getJson($tileUrl)->assertUnprocessable()->assertJsonValidationErrors('quota');

    expect(UsageQuota::query()->where('resource', QuotaService::GCS_CLASS_B)->exists())->toBeFalse()
        ->and(UsageQuota::query()->where('resource', QuotaService::GCS_EGRESS)->exists())->toBeFalse();
});

it('rolls back the GCS operation counter when a download exceeds the egress limit', function (): void {
    config()->set([
        'altura.auth_driver' => 'local',
        'altura.gcs_class_b_soft_limit' => 10,
        'altura.gcs_class_b_hard_limit' => 20,
        'altura.gcs_egress_soft_limit_bytes' => 512,
        'altura.gcs_egress_hard_limit_bytes' => 1024,
    ]);
    $user = User::factory()->create(['firebase_uid' => 'quota-download-user']);
    $asset = Asset::query()->create([
        'user_id' => $user->id, 'kind' => 'result', 'status' => 'ready', 'storage_disk' => 'gcs',
        'storage_path' => 'assets/result.png', 'tile_prefix' => 'tiles/result', 'mime_type' => 'image/png',
        'byte_size' => 2048, 'width' => 1024, 'height' => 1024, 'max_level' => 10,
    ]);

    $this->getJson("/api/v1/assets/{$asset->id}/download", ['Authorization' => 'Bearer local:quota-download-user'])
        ->assertUnprocessable()->assertJsonValidationErrors('quota');

    expect(UsageQuota::query()->where('resource', QuotaService::GCS_CLASS_B)->exists())->toBeFalse()
        ->and(UsageQuota::query()->where('resource', QuotaService::GCS_EGRESS)->exists())->toBeFalse();
});
