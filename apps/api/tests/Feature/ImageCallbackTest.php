<?php

use App\Models\Asset;
use App\Models\CreditLedger;
use App\Models\Job;
use App\Models\User;
use App\Services\CreditService;
use Illuminate\Testing\TestResponse;

beforeEach(function (): void {
    config()->set('altura.callback_secret', 'callback-test-secret-with-32-characters');
});

function callbackFixture(): array
{
    $user = User::factory()->create(['credit_balance' => 20]);
    $source = Asset::query()->create([
        'user_id' => $user->id,
        'kind' => 'original',
        'status' => 'ready',
        'storage_disk' => 'local',
        'storage_path' => "assets/{$user->id}/source/original.png",
        'mime_type' => 'image/png',
        'byte_size' => 1000,
        'width' => 572,
        'height' => 1024,
    ]);
    $result = Asset::query()->create([
        'user_id' => $user->id,
        'kind' => 'result',
        'status' => 'pending',
        'storage_disk' => 'local',
        'storage_path' => "assets/{$user->id}/results/result.png",
        'mime_type' => 'image/png',
        'byte_size' => 0,
        'quota_bytes' => 1000,
        'width' => 572,
        'height' => 1024,
    ]);
    $job = Job::query()->create([
        'user_id' => $user->id,
        'source_asset_id' => $source->id,
        'result_asset_id' => $result->id,
        'tool' => 'upscaler',
        'status' => 'processing',
        'credits' => 2,
        'settings' => ['scale' => 4, 'format' => 'png'],
        'provider_job_id' => 'provider-1',
    ]);
    app(CreditService::class)->reserve($user, $job, 2);

    return [$user, $job, $result];
}

function sendImageCallback(array $payload): TestResponse
{
    $body = json_encode($payload, JSON_THROW_ON_ERROR);
    $signature = hash_hmac('sha256', $body, config('altura.callback_secret'));

    return test()->call('POST', '/api/internal/image-callback', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_ACCEPT' => 'application/json',
        'HTTP_X_ALTURA_SIGNATURE' => $signature,
    ], $body);
}

it('keeps a failed and refunded image job terminal when a late ready callback arrives', function (): void {
    [$user, $job, $result] = callbackFixture();

    sendImageCallback([
        'jobId' => $job->id,
        'status' => 'failed',
        'providerRequestId' => 'provider-1',
        'error' => 'Provider failed.',
    ])->assertOk();

    sendImageCallback([
        'jobId' => $job->id,
        'status' => 'ready',
        'providerRequestId' => 'provider-1',
        'resultObject' => $result->storage_path,
        'pyramidPrefix' => "tiles/{$result->id}",
        'width' => 2288,
        'height' => 4096,
        'maxLevel' => 12,
        'byteSize' => 2000,
        'storedBytes' => 3000,
        'mimeType' => 'image/png',
    ])->assertOk();

    expect($job->fresh()->status)->toBe('failed')
        ->and($result->fresh()->status)->toBe('failed')
        ->and($user->fresh()->credit_balance)->toBe(20)
        ->and(CreditLedger::query()->where('type', 'refund')->count())->toBe(1)
        ->and(CreditLedger::query()->where('type', 'capture')->count())->toBe(0);
});

it('rejects a ready callback that points outside the reserved job', function (): void {
    [, $job, $result] = callbackFixture();

    sendImageCallback([
        'jobId' => $job->id,
        'status' => 'ready',
        'providerRequestId' => 'provider-1',
        'resultObject' => 'assets/another-user/private.png',
        'pyramidPrefix' => "tiles/{$result->id}",
        'width' => 2288,
        'height' => 4096,
        'maxLevel' => 12,
        'byteSize' => 2000,
        'storedBytes' => 3000,
        'mimeType' => 'image/png',
    ])->assertUnprocessable()->assertJsonValidationErrors('resultObject');

    expect($job->fresh()->status)->toBe('processing');
});
