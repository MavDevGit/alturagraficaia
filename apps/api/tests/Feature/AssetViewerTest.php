<?php

use App\Models\Asset;
use App\Models\UsageQuota;
use App\Models\User;
use App\Services\QuotaService;
use Illuminate\Support\Facades\Storage;

it('returns one tokenized complete-image URL and serves a local original', function (): void {
    config()->set('altura.auth_driver', 'local');
    Storage::fake('local');
    $user = User::factory()->create(['firebase_uid' => 'viewer-user']);
    $asset = Asset::query()->create([
        'user_id' => $user->id, 'kind' => 'original', 'status' => 'ready', 'storage_disk' => 'local',
        'storage_path' => 'assets/original.png', 'mime_type' => 'image/png',
        'byte_size' => 2048, 'width' => 8000, 'height' => 3152,
    ]);
    Storage::disk('local')->put($asset->storage_path, 'complete-image');

    $payload = $this->getJson("/api/v1/assets/{$asset->id}/viewer", ['Authorization' => 'Bearer local:viewer-user'])
        ->assertOk()
        ->assertJsonPath('mime_type', 'image/png')
        ->assertJsonPath('ready', true)
        ->assertJsonMissingPath('tile_url')
        ->json();

    expect($payload['image_url'])->toContain("/assets/{$asset->id}/content?token=")->not->toContain('/tiles/');
    $this->get($payload['image_url'])->assertOk()->assertHeader('Content-Type', 'image/png');
});

it('redirects viewer content and downloads directly to the FAL result', function (): void {
    config()->set('altura.auth_driver', 'local');
    $user = User::factory()->create(['firebase_uid' => 'fal-viewer-user']);
    $resultUrl = 'https://v3b.fal.media/files/example/full-result.png';
    $asset = Asset::query()->create([
        'user_id' => $user->id, 'kind' => 'result', 'status' => 'ready', 'storage_disk' => 'fal',
        'storage_path' => "external/result", 'external_url' => $resultUrl, 'mime_type' => 'image/png',
        'byte_size' => 200_000_000, 'width' => 20000, 'height' => 10000,
    ]);

    $payload = $this->getJson("/api/v1/assets/{$asset->id}/viewer", ['Authorization' => 'Bearer local:fal-viewer-user'])
        ->assertOk()->json();
    $this->get($payload['image_url'])->assertRedirect($resultUrl);
    $this->get("/api/v1/assets/{$asset->id}/download", ['Authorization' => 'Bearer local:fal-viewer-user'])
        ->assertRedirect($resultUrl);

    expect(UsageQuota::query()->whereIn('resource', [QuotaService::GCS_CLASS_B, QuotaService::GCS_EGRESS])->exists())->toBeFalse();
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

it('rejects complete GCS content before signing when the monthly read limit is reached', function (): void {
    config()->set([
        'altura.auth_driver' => 'local',
        'altura.gcs_class_b_soft_limit' => 0,
        'altura.gcs_class_b_hard_limit' => 0,
    ]);
    $user = User::factory()->create(['firebase_uid' => 'quota-content-user']);
    $asset = Asset::query()->create([
        'user_id' => $user->id, 'kind' => 'original', 'status' => 'ready', 'storage_disk' => 'gcs',
        'storage_path' => 'assets/original.png', 'mime_type' => 'image/png',
        'byte_size' => 2048, 'width' => 1024, 'height' => 1024,
    ]);
    $payload = $this->getJson("/api/v1/assets/{$asset->id}/viewer", ['Authorization' => 'Bearer local:quota-content-user'])
        ->assertOk()->json();

    $this->getJson($payload['image_url'])->assertUnprocessable()->assertJsonValidationErrors('quota');

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
        'user_id' => $user->id, 'kind' => 'original', 'status' => 'ready', 'storage_disk' => 'gcs',
        'storage_path' => 'assets/original.png', 'mime_type' => 'image/png',
        'byte_size' => 2048, 'width' => 1024, 'height' => 1024,
    ]);

    $this->getJson("/api/v1/assets/{$asset->id}/download", ['Authorization' => 'Bearer local:quota-download-user'])
        ->assertUnprocessable()->assertJsonValidationErrors('quota');

    expect(UsageQuota::query()->where('resource', QuotaService::GCS_CLASS_B)->exists())->toBeFalse()
        ->and(UsageQuota::query()->where('resource', QuotaService::GCS_EGRESS)->exists())->toBeFalse();
});
