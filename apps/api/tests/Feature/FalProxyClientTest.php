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
