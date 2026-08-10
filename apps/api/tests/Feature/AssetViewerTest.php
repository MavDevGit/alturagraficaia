<?php

use App\Models\Asset;
use App\Models\User;

it('serves viewer redirects and direct FAL download descriptors', function (): void {
    config()->set('altura.auth_driver', 'local');
    $user = User::factory()->create(['firebase_uid' => 'viewer-user']);
    $resultUrl = 'https://v3b.fal.media/files/example/full-result.png';
    $asset = Asset::query()->create([
        'user_id' => $user->id,
        'kind' => 'result',
        'status' => 'ready',
        'external_url' => $resultUrl,
        'mime_type' => 'image/png',
        'byte_size' => 750_000_000,
        'width' => 20000,
        'height' => 10000,
        'expires_at' => now()->addDays(7),
    ]);

    $payload = $this->getJson("/api/v1/assets/{$asset->id}/viewer", ['Authorization' => 'Bearer local:viewer-user'])
        ->assertOk()
        ->assertJsonPath('ready', true)
        ->assertJsonMissingPath('tile_url')
        ->json();

    expect($payload['image_url'])->toContain("/assets/{$asset->id}/content?token=");
    $this->get($payload['image_url'])->assertRedirect($resultUrl);
    $this->getJson("/api/v1/assets/{$asset->id}/download", ['Authorization' => 'Bearer local:viewer-user'])
        ->assertOk()
        ->assertJsonPath('url', $resultUrl)
        ->assertJsonPath('filename', "altura-grafica-ia-{$asset->id}.png");
});

it('does not expose another users FAL asset descriptor', function (): void {
    config()->set('altura.auth_driver', 'local');
    $owner = User::factory()->create(['firebase_uid' => 'asset-owner']);
    User::factory()->create(['firebase_uid' => 'asset-stranger']);
    $asset = Asset::query()->create([
        'user_id' => $owner->id,
        'kind' => 'original',
        'status' => 'ready',
        'external_url' => 'https://v3b.fal.media/files/example/original.png',
        'mime_type' => 'image/png',
        'byte_size' => 1000,
        'width' => 100,
        'height' => 100,
    ]);

    $this->getJson("/api/v1/assets/{$asset->id}/viewer", ['Authorization' => 'Bearer local:asset-stranger'])
        ->assertNotFound();
});
