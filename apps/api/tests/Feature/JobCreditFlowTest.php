<?php

use App\Jobs\BuildAssetPyramidJob;
use App\Jobs\ProcessImageJob;
use App\Models\CreditLedger;
use App\Models\Job;
use App\Models\ToolSetting;
use App\Models\UsageQuota;
use App\Models\User;
use App\Services\CreditService;
use App\Services\QuotaService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function (): void {
    config()->set('altura.auth_driver', 'local');
    config()->set('altura.initial_credits', 20);
    Storage::fake('local');
    Queue::fake();
    foreach ([
        ['tool' => 'upscaler', 'model' => 'fake/upscaler', 'base_credits' => 1],
        ['tool' => 'background-remover', 'model' => 'fake/background', 'base_credits' => 2],
        ['tool' => 'outpainting', 'model' => 'fake/outpainting', 'base_credits' => 4],
    ] as $setting) {
        ToolSetting::query()->create($setting);
    }
});

function localHeaders(string $uid = 'credit-test'): array
{
    return ['Authorization' => "Bearer local:{$uid}"];
}

it('uploads an original and queues its deep zoom pyramid', function (): void {
    $response = $this->post('/api/v1/uploads', [
        'file' => UploadedFile::fake()->image('source.png', 572, 1024),
    ], localHeaders());

    $response->assertCreated()->assertJsonPath('width', 572)->assertJsonPath('height', 1024);
    Queue::assertPushed(BuildAssetPyramidJob::class);
    expect(User::query()->first()->credit_balance)->toBe(20);
});

it('reserves credits atomically and refunds once on cancellation', function (): void {
    $asset = $this->post('/api/v1/uploads', [
        'file' => UploadedFile::fake()->image('source.png', 572, 1024),
    ], localHeaders())->json();
    $originalQuota = UsageQuota::query()->where('resource', 'storage_bytes')->value('used');

    $job = $this->postJson('/api/v1/jobs', [
        'tool' => 'upscaler', 'source_asset_id' => $asset['id'],
        'settings' => [
            'upscaleMode' => 'factor',
            'scale' => 4,
            'format' => 'png',
            'fidelity' => 0.1,
        ],
    ], localHeaders())->assertCreated()->json();

    expect(User::query()->first()->credit_balance)->toBe(18)
        ->and(CreditLedger::query()->where('type', 'reservation')->count())->toBe(1)
        ->and(Job::query()->findOrFail($job['id'])->settings['upscaleMode'])->toBe('factor');
    Queue::assertPushed(ProcessImageJob::class);

    Job::query()->findOrFail($job['id'])->update([
        'status' => 'processing',
        'provider_job_id' => 'fal-cancellable-request',
    ]);
    Http::fake([
        'http://127.0.0.1:8787/v1/jobs/*/cancel' => Http::response(['accepted' => true], 202),
    ]);

    $this->postJson("/api/v1/jobs/{$job['id']}/cancel", [], localHeaders())->assertOk()->assertJsonPath('status', 'cancelled');
    $this->postJson("/api/v1/jobs/{$job['id']}/cancel", [], localHeaders())->assertOk();
    expect(User::query()->first()->credit_balance)->toBe(20)
        ->and(CreditLedger::query()->where('type', 'refund')->count())->toBe(1)
        ->and(UsageQuota::query()->where('resource', 'storage_bytes')->value('used'))->toBe($originalQuota);
    Http::assertSent(fn ($request) => str_ends_with($request->url(), "/v1/jobs/{$job['id']}/cancel"));
});

it('persists only settings supported by each provider contract', function (): void {
    $asset = $this->post('/api/v1/uploads', [
        'file' => UploadedFile::fake()->image('source.png', 572, 1024),
    ], localHeaders('settings-test'))->json();

    $outpainting = $this->postJson('/api/v1/jobs', [
        'tool' => 'outpainting',
        'source_asset_id' => $asset['id'],
        'settings' => [
            'format' => 'png',
            'mode' => 'fast',
            'expandRight' => 256,
        ],
    ], localHeaders('settings-test'))->assertCreated()->json();

    expect(Job::query()->findOrFail($outpainting['id'])->settings['mode'])->toBe('fast');

    $upscaler = $this->postJson('/api/v1/jobs', [
        'tool' => 'upscaler',
        'source_asset_id' => $asset['id'],
        'settings' => [
            'upscaleMode' => 'target',
            'targetResolution' => '2160p',
            'format' => 'png',
            'fidelity' => 0.25,
        ],
    ], localHeaders('settings-test'))->assertCreated()->json();

    expect(Job::query()->findOrFail($upscaler['id'])->settings)
        ->toMatchArray([
            'upscaleMode' => 'target',
            'targetResolution' => '2160p',
            'fidelity' => 0.25,
        ]);

    $this->postJson('/api/v1/jobs', [
        'tool' => 'background-remover',
        'source_asset_id' => $asset['id'],
        'settings' => ['format' => 'webp'],
    ], localHeaders('settings-test'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('settings.format');

    $this->postJson('/api/v1/jobs', [
        'tool' => 'outpainting',
        'source_asset_id' => $asset['id'],
        'settings' => ['format' => 'webp', 'expandRight' => 256],
    ], localHeaders('settings-test'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('settings.format');

    $this->postJson('/api/v1/jobs', [
        'tool' => 'outpainting',
        'source_asset_id' => $asset['id'],
        'settings' => ['format' => 'png', 'prompt' => 'unsupported'],
    ], localHeaders('settings-test'))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('settings');
});

it('fails and refunds a stale processing job', function (): void {
    $asset = $this->post('/api/v1/uploads', [
        'file' => UploadedFile::fake()->image('source.png', 572, 1024),
    ], localHeaders('stale-user'))->json();
    $job = $this->postJson('/api/v1/jobs', [
        'tool' => 'upscaler',
        'source_asset_id' => $asset['id'],
        'settings' => ['scale' => 4, 'format' => 'png'],
    ], localHeaders('stale-user'))->assertCreated()->json();
    Job::query()->whereKey($job['id'])->update([
        'status' => 'processing',
        'updated_at' => now()->subHours(13),
    ]);

    $this->artisan('jobs:fail-stale')->assertSuccessful();

    expect(Job::query()->findOrFail($job['id'])->status)->toBe('failed')
        ->and(User::query()->where('firebase_uid', 'stale-user')->value('credit_balance'))->toBe(20)
        ->and(CreditLedger::query()->where('type', 'refund')->count())->toBe(1);
});

it('blocks an upload before exceeding the configured storage ceiling', function (): void {
    config()->set('altura.storage_soft_limit_bytes', 1);
    config()->set('altura.storage_hard_limit_bytes', 1);

    $this->post('/api/v1/uploads', [
        'file' => UploadedFile::fake()->image('source.png', 572, 1024),
    ], localHeaders('quota-test'))->assertUnprocessable()->assertJsonValidationErrors('quota');
});

it('keeps the storage reservation global when the calendar month changes', function (): void {
    config()->set('altura.storage_soft_limit_bytes', 90);
    config()->set('altura.storage_hard_limit_bytes', 100);
    $quotas = app(QuotaService::class);

    $quotas->reserveStorage(40);
    $this->travelTo(now()->addMonth());
    $quotas->reserveStorage(30);

    expect(UsageQuota::query()->where('resource', QuotaService::STORAGE)->count())->toBe(1)
        ->and(UsageQuota::query()->where('resource', QuotaService::STORAGE)->value('period_start')->toDateString())->toBe('1970-01-01')
        ->and(UsageQuota::query()->where('resource', QuotaService::STORAGE)->value('used'))->toBe(70);
});

it('blocks a pyramid before exceeding the GCS Class A operation ceiling', function (): void {
    config()->set('altura.gcs_class_a_soft_limit', 1);
    config()->set('altura.gcs_class_a_hard_limit', 1);

    $this->post('/api/v1/uploads', [
        'file' => UploadedFile::fake()->image('source.png', 572, 1024),
    ], localHeaders('gcs-operations-quota'))->assertUnprocessable()->assertJsonValidationErrors('quota');

    expect(UsageQuota::query()->where('resource', QuotaService::STORAGE)->value('used'))->toBe(0)
        ->and(UsageQuota::query()->where('resource', QuotaService::GCS_CLASS_A)->exists())->toBeFalse();
});

it('never permits a reservation that makes the balance negative', function (): void {
    $asset = $this->post('/api/v1/uploads', [
        'file' => UploadedFile::fake()->image('source.png', 572, 1024),
    ], localHeaders('low-credit'))->json();
    User::query()->first()->update(['credit_balance' => 0]);

    $this->postJson('/api/v1/jobs', [
        'tool' => 'outpainting', 'source_asset_id' => $asset['id'], 'settings' => ['format' => 'png'],
    ], localHeaders('low-credit'))->assertUnprocessable()->assertJsonValidationErrors('credits');
    expect(User::query()->first()->credit_balance)->toBe(0);
});

it('applies an administrative credit adjustment only once per idempotency key', function (): void {
    $user = User::factory()->create(['credit_balance' => 20]);
    $credits = app(CreditService::class);

    $credits->adjust($user, 5, 'Bonificación de soporte.', 'support-adjustment-1');
    $credits->adjust($user, 5, 'Bonificación de soporte.', 'support-adjustment-1');

    expect($user->fresh()->credit_balance)->toBe(25)
        ->and(CreditLedger::query()->where('idempotency_key', 'support-adjustment-1')->count())->toBe(1);
});
