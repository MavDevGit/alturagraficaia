+<?php

use App\Services\FalWebhookVerifier;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

it('verifies the official FAL Ed25519 webhook signature and rejects replays', function (): void {
    Cache::forget('fal-webhook-jwks');
    $keypair = sodium_crypto_sign_keypair();
    $publicKey = sodium_crypto_sign_publickey($keypair);
    $secretKey = sodium_crypto_sign_secretkey($keypair);
    $encodedKey = rtrim(strtr(base64_encode($publicKey), '+/', '-_'), '=');
    Http::fake(['https://rest.fal.ai/.well-known/jwks.json' => Http::response(['keys' => [['x' => $encodedKey]]])]);

    $body = json_encode(['request_id' => 'request-1', 'status' => 'OK'], JSON_THROW_ON_ERROR);
    $requestId = 'webhook-1';
    $userId = 'fal-user';
    $timestamp = (string) time();
    $message = implode("\n", [$requestId, $userId, $timestamp, hash('sha256', $body)]);
    $signature = bin2hex(sodium_crypto_sign_detached($message, $secretKey));
    $request = Request::create('/', 'POST', [], [], [], [
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_FAL_WEBHOOK_REQUEST_ID' => $requestId,
        'HTTP_X_FAL_WEBHOOK_USER_ID' => $userId,
        'HTTP_X_FAL_WEBHOOK_TIMESTAMP' => $timestamp,
        'HTTP_X_FAL_WEBHOOK_SIGNATURE' => $signature,
    ], $body);

    expect(app(FalWebhookVerifier::class)->valid($request, $body))->toBeTrue();

    $request->headers->set('X-Fal-Webhook-Timestamp', (string) (time() - 301));
    expect(app(FalWebhookVerifier::class)->valid($request, $body))->toBeFalse();
});

