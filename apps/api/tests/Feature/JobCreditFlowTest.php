<?php

use App\Jobs\ProcessImageJob;
use App\Models\Asset;
use App\Models\CreditLedger;
use App\Models\Job;
use App\Models\ToolSetting;
use App\Models\UsageQuota;
use App\Models\User;
use App\Services\CreditService;
use App\Services\FalClient;
use App\Services\QuotaService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;

beforeEach(function (): void {
    config()->set(['altura.auth_driver' => 'local', 'altura.initial_credits' => 20, 'altura.fal_key' => 'test-fal-key-value']);
    Queue::fake();
    Http::fake([
        'https://rest.alpha.fal.ai/storage/upload/initiate*' => Http::response([
            'upload_url' => 'https://upload.fal.media/direct-ticket',
            'file_url' => 'https://v3b.fal.media/files/example/source.png',
        ]),
        'https://v3b.fal.media/files/example/source.png' => Http::response('', 200, [
            'Content-Type' => 'image/png', 'Content-Length' => '2048',
        ]),
        'https://queue.fal.run/*/cancel' => Http::response(['accepted' => true], 202),
        'https://queue.fal.run/*' => Http::response(['request_id' => 'fal-request-1'], 202),
    ]);
    foreach ([
        ['tool' => 'upscaler', 'model' => 'fal-ai/seedvr/upscale/image', 'base_credits' => 1],
        ['tool' => 'background-remover', 'model' => 'fal-ai/bria/background/remove', 'base_credits' => 2],
        ['tool' => 'outpainting', 'model' => 'fal-ai/flux-2-pro/outpaint', 'base_credits' => 4],
    ] as $setting) {
        ToolSetting::query()->updateOrCreate(['tool' => $setting['tool']], $setting);
    }
});

function localHeaders(string $uid = 'credit-test'): array
{
    return ['Authorization' => "Bearer local:{$uid}"];
}

function uploadedFalAsset($test, string $uid = 'credit-test'): array
{
    $ticket = $test->postJson('/api/v1/uploads/initiate', [
        'file_name' => 'source.png', 'mime_type' => 'image/png', 'byte_size' => 2048,
        'width' => 572, 'height' => 1024,
    ], localHeaders($uid))->assertCreated()->json();

    return $test->postJson("/api/v1/uploads/{$ticket['asset']['id']}/complete", [], localHeaders($uid))
        ->assertOk()->json();
}

it('creates a direct FAL upload ticket and completes it without local media storage', function (): void {
    $asset = uploadedFalAsset($this);

    expect($asset['status'])->toBe('ready')
        ->and(Asset::query()->findOrFail($asset['id'])->external_url)->toStartWith('https://v3b.fal.media/')
        ->and(UsageQuota::query()->exists())->toBeFalse();
    Http::assertSent(fn ($request) => str_contains($request->url(), '/storage/upload/initiate')
        && $request->hasHeader('X-Fal-Object-Lifecycle-Preference'));
});

it('returns a useful service unavailable response without creating assets or charging credits', function (): void {
    Http::fake([
        'https://rest.alpha.fal.ai/storage/upload/initiate*' => Http::failedConnection('FAL unavailable'),
    ]);

    $this->postJson('/api/v1/uploads/initiate', [
        'file_name' => 'source.png', 'mime_type' => 'image/png', 'byte_size' => 2048,
        'width' => 572, 'height' => 1024,
    ], localHeaders('unavailable-user'))
        ->assertServiceUnavailable()
        ->assertJsonPath('message', 'FAL no está disponible temporalmente. No se cargó la imagen ni se descontaron créditos.');

    expect(Asset::query()->exists())->toBeFalse()
        ->and(CreditLedger::query()->exists())->toBeFalse()
        ->and(User::query()->where('firebase_uid', 'unavailable-user')->value('credit_balance'))->toBe(20);
});

it('reserves credits and submits only JSON and the FAL source URL', function (): void {
    $asset = uploadedFalAsset($this);
    $jobPayload = $this->postJson('/api/v1/jobs', [
        'tool' => 'upscaler', 'source_asset_id' => $asset['id'],
        'settings' => ['upscaleMode' => 'factor', 'scale' => 4, 'format' => 'png', 'fidelity' => 0.1],
    ], localHeaders())->assertCreated()->json();

    expect(User::query()->first()->credit_balance)->toBe(18)
        ->and(CreditLedger::query()->where('type', 'reservation')->count())->toBe(1)
        ->and(Job::query()->findOrFail($jobPayload['id'])->resultAsset->external_url)->toBeNull();
    Queue::assertPushed(ProcessImageJob::class);

    (new ProcessImageJob($jobPayload['id']))->handle(app(FalClient::class));
    expect(Job::query()->findOrFail($jobPayload['id'])->provider_job_id)->toBe('fal-request-1');
    Http::assertSent(function ($request): bool {
        if (! str_starts_with($request->url(), 'https://queue.fal.run/fal-ai/seedvr/upscale/image')) {
            return false;
        }
        $payload = $request->data();

        return $payload['image_url'] === 'https://v3b.fal.media/files/example/source.png'
            && $payload['upscale_factor'] === 4.0
            && $request->hasHeader('X-Fal-Object-Lifecycle-Preference');
    });
});

it('refunds credits once and cancels the provider request directly from Laravel', function (): void {
    $asset = uploadedFalAsset($this, 'cancel-user');
    $job = $this->postJson('/api/v1/jobs', [
        'tool' => 'upscaler', 'source_asset_id' => $asset['id'],
        'settings' => ['scale' => 4, 'format' => 'png'],
    ], localHeaders('cancel-user'))->assertCreated()->json();
    Job::query()->whereKey($job['id'])->update(['status' => 'processing', 'provider_job_id' => 'fal-request-1']);

    $this->postJson("/api/v1/jobs/{$job['id']}/cancel", [], localHeaders('cancel-user'))->assertOk();
    $this->postJson("/api/v1/jobs/{$job['id']}/cancel", [], localHeaders('cancel-user'))->assertOk();

    expect(User::query()->where('firebase_uid', 'cancel-user')->value('credit_balance'))->toBe(20)
        ->and(CreditLedger::query()->where('type', 'refund')->count())->toBe(1);
    Http::assertSent(fn ($request) => str_contains($request->url(), '/requests/fal-request-1/cancel'));
});

it('persists only settings supported by each provider contract', function (): void {
    $asset = uploadedFalAsset($this, 'settings-user');
    $outpainting = $this->postJson('/api/v1/jobs', [
        'tool' => 'outpainting', 'source_asset_id' => $asset['id'],
        'settings' => ['format' => 'png', 'mode' => 'fast', 'expandRight' => 256],
    ], localHeaders('settings-user'))->assertCreated()->json();
    expect(Job::query()->findOrFail($outpainting['id'])->settings['mode'])->toBe('fast');

    $this->postJson('/api/v1/jobs', [
        'tool' => 'background-remover', 'source_asset_id' => $asset['id'],
        'settings' => ['format' => 'webp'],
    ], localHeaders('settings-user'))->assertUnprocessable()->assertJsonValidationErrors('settings.format');
});

it('submits the exact Bria and FLUX outpainting contracts', function (): void {
    $asset = uploadedFalAsset($this, 'engine-contract-user');
    $background = $this->postJson('/api/v1/jobs', [
        'tool' => 'background-remover', 'source_asset_id' => $asset['id'],
        'settings' => ['format' => 'png'],
    ], localHeaders('engine-contract-user'))->assertCreated()->json();
    $outpainting = $this->postJson('/api/v1/jobs', [
        'tool' => 'outpainting', 'source_asset_id' => $asset['id'],
        'settings' => [
            'format' => 'jpeg', 'mode' => 'fast',
            'expandTop' => 16, 'expandBottom' => 32, 'expandLeft' => 48, 'expandRight' => 64,
        ],
    ], localHeaders('engine-contract-user'))->assertCreated()->json();

    (new ProcessImageJob($background['id']))->handle(app(FalClient::class));
    (new ProcessImageJob($outpainting['id']))->handle(app(FalClient::class));

    Http::assertSent(function ($request): bool {
        return str_starts_with($request->url(), 'https://queue.fal.run/fal-ai/bria/background/remove?')
            && $request->data() === [
                'image_url' => 'https://v3b.fal.media/files/example/source.png',
                'sync_mode' => false,
            ];
    });
    Http::assertSent(function ($request): bool {
        return str_starts_with($request->url(), 'https://queue.fal.run/fal-ai/flux-2-pro/outpaint?')
            && $request->data() === [
                'image_url' => 'https://v3b.fal.media/files/example/source.png',
                'expand_top' => 16,
                'expand_bottom' => 32,
                'expand_left' => 48,
                'expand_right' => 64,
                'auto_crop' => false,
                'mode' => 'fast',
                'enable_safety_checker' => true,
                'output_format' => 'jpeg',
                'sync_mode' => false,
            ];
    });
});

it('fails and refunds a stale processing job', function (): void {
    $asset = uploadedFalAsset($this, 'stale-user');
    $job = $this->postJson('/api/v1/jobs', [
        'tool' => 'upscaler', 'source_asset_id' => $asset['id'], 'settings' => ['scale' => 4, 'format' => 'png'],
    ], localHeaders('stale-user'))->assertCreated()->json();
    Job::query()->whereKey($job['id'])->update(['status' => 'processing', 'updated_at' => now()->subHours(13)]);

    $this->artisan('jobs:fail-stale')->assertSuccessful();
    expect(Job::query()->findOrFail($job['id'])->status)->toBe('failed')
        ->and(User::query()->where('firebase_uid', 'stale-user')->value('credit_balance'))->toBe(20);
});

it('blocks a job before exceeding the monthly processing ceiling', function (): void {
    config()->set(['altura.image_jobs_soft_limit' => 0, 'altura.image_jobs_hard_limit' => 0]);
    $asset = uploadedFalAsset($this, 'quota-user');

    $this->postJson('/api/v1/jobs', [
        'tool' => 'upscaler', 'source_asset_id' => $asset['id'], 'settings' => ['scale' => 2, 'format' => 'png'],
    ], localHeaders('quota-user'))->assertUnprocessable()->assertJsonValidationErrors('quota');
});

it('never permits a credit reservation that makes the balance negative', function (): void {
    $asset = uploadedFalAsset($this, 'low-credit');
    User::query()->where('firebase_uid', 'low-credit')->update(['credit_balance' => 0]);

    $this->postJson('/api/v1/jobs', [
        'tool' => 'outpainting', 'source_asset_id' => $asset['id'], 'settings' => ['format' => 'png'],
    ], localHeaders('low-credit'))->assertUnprocessable()->assertJsonValidationErrors('credits');
});

it('applies an administrative credit adjustment only once per idempotency key', function (): void {
    $user = User::factory()->create(['credit_balance' => 20]);
    $credits = app(CreditService::class);
    $credits->adjust($user, 5, 'Bonificación de soporte.', 'support-adjustment-1');
    $credits->adjust($user, 5, 'Bonificación de soporte.', 'support-adjustment-1');

    expect($user->fresh()->credit_balance)->toBe(25)
        ->and(CreditLedger::query()->where('idempotency_key', 'support-adjustment-1')->count())->toBe(1);
});
