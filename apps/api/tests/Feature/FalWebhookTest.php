<?php

use App\Models\Asset;
use App\Models\CreditLedger;
use App\Models\Job;
use App\Models\User;
use App\Services\CreditService;
use App\Services\FalWebhookVerifier;
use Illuminate\Testing\TestResponse;

beforeEach(function (): void {
    $verifier = Mockery::mock(FalWebhookVerifier::class);
    $verifier->shouldReceive('valid')->andReturnTrue();
    app()->instance(FalWebhookVerifier::class, $verifier);
});

function falWebhookFixture(): array
{
    $user = User::factory()->create(['credit_balance' => 20]);
    $source = Asset::query()->create([
        'user_id' => $user->id, 'kind' => 'original', 'status' => 'ready',
        'external_url' => 'https://v3b.fal.media/files/example/source.png',
        'mime_type' => 'image/png', 'byte_size' => 1000, 'width' => 572, 'height' => 1024,
    ]);
    $result = Asset::query()->create([
        'user_id' => $user->id, 'kind' => 'result', 'status' => 'pending',
        'external_url' => null, 'mime_type' => 'image/png', 'byte_size' => 0,
        'width' => 2288, 'height' => 4096,
    ]);
    $job = Job::query()->create([
        'user_id' => $user->id, 'source_asset_id' => $source->id, 'result_asset_id' => $result->id,
        'tool' => 'upscaler', 'status' => 'processing', 'credits' => 2,
        'settings' => ['scale' => 4, 'format' => 'png'], 'provider_job_id' => 'provider-1',
    ]);
    app(CreditService::class)->reserve($user, $job, 2);

    return [$user, $job, $result];
}

function sendFalWebhook(Job $job, array $payload): TestResponse
{
    return test()->postJson("/api/internal/fal-webhook?job_id={$job->id}", $payload);
}

it('stores the FAL result URL and captures credits exactly once', function (): void {
    [$user, $job, $result] = falWebhookFixture();
    $resultUrl = 'https://v3b.fal.media/files/example/result.png';
    $payload = [
        'request_id' => 'provider-1', 'status' => 'OK',
        'payload' => ['image' => [
            'url' => $resultUrl, 'width' => 2288, 'height' => 4096,
            'file_size' => 750_000_000, 'content_type' => 'image/png',
        ]],
    ];

    sendFalWebhook($job, $payload)->assertOk();
    sendFalWebhook($job, $payload)->assertOk();

    expect($job->fresh()->status)->toBe('completed')
        ->and($result->fresh()->external_url)->toBe($resultUrl)
        ->and($result->fresh()->byte_size)->toBe(750_000_000)
        ->and($result->fresh()->expires_at->greaterThan(now()->addDays(6)))->toBeTrue()
        ->and($user->fresh()->credit_balance)->toBe(18)
        ->and(CreditLedger::query()->where('type', 'capture')->count())->toBe(1);
});

it('accepts an immediate signed webhook before the queue request id is persisted', function (): void {
    [, $job] = falWebhookFixture();
    $job->update(['provider_job_id' => null]);

    sendFalWebhook($job, [
        'request_id' => 'provider-fast', 'status' => 'OK',
        'payload' => ['image' => ['url' => 'https://v3b.fal.media/files/example/fast.png']],
    ])->assertOk();

    expect($job->fresh()->provider_job_id)->toBe('provider-fast')
        ->and($job->fresh()->status)->toBe('completed');
});

it('stores the Bria transparent image contract', function (): void {
    [, $job, $result] = falWebhookFixture();
    $job->update(['tool' => 'background-remover', 'settings' => ['format' => 'png']]);
    $result->update(['width' => 572, 'height' => 1024, 'mime_type' => 'image/png']);
    $resultUrl = 'https://v3b.fal.media/files/example/transparent.png';

    sendFalWebhook($job, [
        'request_id' => 'provider-1', 'status' => 'OK',
        'payload' => ['image' => [
            'url' => $resultUrl,
            'width' => 572,
            'height' => 1024,
            'content_type' => 'image/png',
        ]],
    ])->assertOk();

    expect($job->fresh()->status)->toBe('completed')
        ->and($result->fresh()->external_url)->toBe($resultUrl)
        ->and($result->fresh()->mime_type)->toBe('image/png')
        ->and($result->fresh()->width)->toBe(572)
        ->and($result->fresh()->height)->toBe(1024);
});

it('stores the first FLUX outpainting image and preserves expected dimensions when metadata is omitted', function (): void {
    [, $job, $result] = falWebhookFixture();
    $job->update(['tool' => 'outpainting', 'settings' => [
        'format' => 'png', 'expandTop' => 16, 'expandBottom' => 32,
        'expandLeft' => 48, 'expandRight' => 64,
    ]]);
    $result->update(['width' => 684, 'height' => 1072, 'mime_type' => 'image/png']);
    $resultUrl = 'https://v3b.fal.media/files/example/outpaint.png';

    sendFalWebhook($job, [
        'request_id' => 'provider-1', 'status' => 'OK',
        'payload' => ['images' => [[
            'url' => $resultUrl, 'content_type' => 'image/png',
        ]]],
    ])->assertOk();

    expect($job->fresh()->status)->toBe('completed')
        ->and($result->fresh()->external_url)->toBe($resultUrl)
        ->and($result->fresh()->width)->toBe(684)
        ->and($result->fresh()->height)->toBe(1072)
        ->and($result->fresh()->mime_type)->toBe('image/png')
        ->and($result->fresh()->byte_size)->toBe(0);
});

it('uses the useful provider detail when an engine rejects its input', function (): void {
    [, $job] = falWebhookFixture();

    sendFalWebhook($job, [
        'request_id' => 'provider-1', 'status' => 'ERROR',
        'error' => 'Invalid status code: 422',
        'payload' => ['detail' => [[
            'loc' => ['body', 'image_url'],
            'msg' => 'FAL no pudo descargar la imagen original.',
            'type' => 'file_download_error',
        ]]],
    ])->assertOk();

    expect($job->fresh()->status)->toBe('failed')
        ->and($job->fresh()->error)->toBe('FAL no pudo descargar la imagen original.');
});

it('rejects a webhook whose FAL request id does not belong to the job', function (): void {
    [, $job] = falWebhookFixture();
    sendFalWebhook($job, [
        'request_id' => 'another-request', 'status' => 'OK',
        'payload' => ['image' => ['url' => 'https://v3b.fal.media/files/example/result.png']],
    ])->assertUnprocessable()->assertJsonValidationErrors('request_id');
    expect($job->fresh()->status)->toBe('processing');
});

it('refunds a failed FAL job and ignores a late successful webhook', function (): void {
    [$user, $job, $result] = falWebhookFixture();
    sendFalWebhook($job, ['request_id' => 'provider-1', 'status' => 'ERROR', 'error' => 'Provider failed.'])
        ->assertOk();
    sendFalWebhook($job, [
        'request_id' => 'provider-1', 'status' => 'OK',
        'payload' => ['image' => ['url' => 'https://v3b.fal.media/files/example/result.png']],
    ])->assertOk();

    expect($job->fresh()->status)->toBe('failed')
        ->and($result->fresh()->status)->toBe('failed')
        ->and($user->fresh()->credit_balance)->toBe(20)
        ->and(CreditLedger::query()->where('type', 'refund')->count())->toBe(1)
        ->and(CreditLedger::query()->where('type', 'capture')->count())->toBe(0);
});
