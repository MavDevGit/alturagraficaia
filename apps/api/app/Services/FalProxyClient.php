<?php

namespace App\Services;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class FalProxyClient
{
    public function thumbnailUrl(string $mediaUrl, int $ttlSeconds = 900): ?string
    {
        if (! $this->configured() || ! $this->isAllowedMediaUrl($mediaUrl)) {
            return null;
        }

        $expires = time() + max(60, min(3600, $ttlSeconds));
        $payload = "thumbnail:v1\n{$expires}\n{$mediaUrl}";
        $signature = hash_hmac('sha256', $payload, (string) config('altura.fal_proxy_hmac_secret'));

        return rtrim((string) config('altura.fal_proxy_url'), '/').'/media/thumbnail?'.http_build_query([
            'source' => $mediaUrl,
            'expires' => $expires,
            'signature' => $signature,
        ], '', '&', PHP_QUERY_RFC3986);
    }

    public function configured(): bool
    {
        $url = rtrim((string) config('altura.fal_proxy_url'), '/');
        $secret = (string) config('altura.fal_proxy_hmac_secret');

        return str_starts_with($url, 'https://') && filter_var($url, FILTER_VALIDATE_URL) !== false
            && strlen($secret) >= 32 && ! str_contains($secret, 'change-me');
    }

    /** @param array<string,mixed>|null $json @param array<string,string> $headers */
    public function request(string $method, string $pathAndQuery, ?array $json = null, array $headers = []): Response
    {
        if (! $this->configured()) {
            throw new RuntimeException('El proxy seguro de FAL no está configurado.');
        }
        if (! str_starts_with($pathAndQuery, '/v1/') || str_contains($pathAndQuery, "\n")) {
            throw new RuntimeException('La ruta del proxy de FAL no es válida.');
        }

        $method = strtoupper($method);
        $body = $json === null ? '' : json_encode($json, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $timestamp = (string) time();
        $canonical = implode("\n", [
            'v1',
            $timestamp,
            $method,
            $pathAndQuery,
            hash('sha256', $body),
        ]);
        $signature = hash_hmac('sha256', $canonical, (string) config('altura.fal_proxy_hmac_secret'));

        $request = Http::withHeaders(array_merge($headers, [
            'X-Altura-Timestamp' => $timestamp,
            'X-Altura-Signature' => $signature,
        ]))->acceptJson()->connectTimeout(5)->timeout(30)->retry(2, 250);

        if ($body !== '') {
            $request = $request->withBody($body, 'application/json');
        }

        return $request->send($method, rtrim((string) config('altura.fal_proxy_url'), '/').$pathAndQuery);
    }

    private function isAllowedMediaUrl(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        return $scheme === 'https' && ($host === 'fal.media' || str_ends_with($host, '.fal.media'));
    }
}
