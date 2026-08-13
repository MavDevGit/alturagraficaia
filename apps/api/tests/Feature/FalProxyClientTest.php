<?php

use App\Services\FalProxyClient;
use Illuminate\Support\Facades\Http;

it('signs the exact proxy request without exposing the FAL key', function (): void {
    $secret = 'proxy-test-secret-with-at-least-thirty-two-characters';
    config()->set([
        'altura.fal_key' => '',
        'altura.fal_proxy_url' => 'https://proxy.example',
        'altura.fal_proxy_hmac_secret' => $secret,
    ]);
    Http::fake(['https://proxy.example/*' => Http::response(['request_id' => 'request-1'], 202)]);

    $path = '/v1/queue/fal-ai/model?fal_webhook='.rawurlencode(
        'https://alturagrafica.mavdev.cloud/api/internal/fal-webhook?job_id=job-1'
    );
    app(FalProxyClient::class)->request('POST', $path, ['image_url' => 'https://v3b.fal.media/source.png']);

    Http::assertSent(function ($request) use ($path, $secret): bool {
        $timestamp = $request->header('X-Altura-Timestamp')[0] ?? '';
        $body = $request->body();
        $canonical = implode("\n", ['v1', $timestamp, 'POST', $path, hash('sha256', $body)]);

        return $request->url() === 'https://proxy.example'.$path
            && $request->header('X-Altura-Signature')[0] === hash_hmac('sha256', $canonical, $secret)
            && ! $request->hasHeader('Authorization');
    });
});

it('signs an exact HEAD request used to verify uploaded FAL media', function (): void {
    $secret = 'proxy-test-secret-with-at-least-thirty-two-characters';
    config()->set([
        'altura.fal_key' => '',
        'altura.fal_proxy_url' => 'https://proxy.example',
        'altura.fal_proxy_hmac_secret' => $secret,
    ]);
    Http::fake(['https://proxy.example/*' => Http::response('', 200, ['Content-Length' => '1234'])]);

    $path = '/v1/media/probe?url='.rawurlencode('https://v3b.fal.media/files/image.png?token=signed');
    $response = app(FalProxyClient::class)->request('HEAD', $path);

    expect($response->successful())->toBeTrue()
        ->and($response->header('Content-Length'))->toBe('1234');
    Http::assertSent(function ($request) use ($path, $secret): bool {
        $timestamp = $request->header('X-Altura-Timestamp')[0] ?? '';
        $canonical = implode("\n", ['v1', $timestamp, 'HEAD', $path, hash('sha256', '')]);

        return $request->url() === 'https://proxy.example'.$path
            && $request->method() === 'HEAD'
            && $request->header('X-Altura-Signature')[0] === hash_hmac('sha256', $canonical, $secret)
            && ! $request->hasHeader('Authorization');
    });
});
