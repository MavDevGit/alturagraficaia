<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class FalWebhookVerifier
{
    public function valid(Request $request, string $rawBody): bool
    {
        $requestId = (string) $request->header('X-Fal-Webhook-Request-Id');
        $userId = (string) $request->header('X-Fal-Webhook-User-Id');
        $timestamp = (string) $request->header('X-Fal-Webhook-Timestamp');
        $signatureHex = (string) $request->header('X-Fal-Webhook-Signature');
        if ($requestId === '' || $userId === '' || $timestamp === '' || $signatureHex === '') {
            return false;
        }
        if (! ctype_digit($timestamp) || abs(time() - (int) $timestamp) > 300) {
            return false;
        }
        $signature = hex2bin($signatureHex);
        if ($signature === false || strlen($signature) !== SODIUM_CRYPTO_SIGN_BYTES) {
            return false;
        }

        $message = implode("\n", [$requestId, $userId, $timestamp, hash('sha256', $rawBody)]);
        foreach ($this->keys() as $key) {
            $encoded = $key['x'] ?? null;
            if (! is_string($encoded)) {
                continue;
            }
            $publicKey = $this->base64UrlDecode($encoded);
            if ($publicKey !== null && strlen($publicKey) === SODIUM_CRYPTO_SIGN_PUBLICKEYBYTES
                && sodium_crypto_sign_verify_detached($signature, $message, $publicKey)) {
                return true;
            }
        }

        return false;
    }

    /** @return array<int,array{x?:string}> */
    private function keys(): array
    {
        return Cache::remember('fal-webhook-jwks', now()->addHours(23), function (): array {
            $response = Http::connectTimeout(5)->timeout(10)
                ->get('https://rest.fal.ai/.well-known/jwks.json')->throw()->json();

            return is_array($response['keys'] ?? null) ? $response['keys'] : [];
        });
    }

    private function base64UrlDecode(string $value): ?string
    {
        $value .= str_repeat('=', (4 - strlen($value) % 4) % 4);
        $decoded = base64_decode(strtr($value, '-_', '+/'), true);

        return $decoded === false ? null : $decoded;
    }
}
