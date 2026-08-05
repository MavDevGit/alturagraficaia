<?php

namespace App\Services;

use App\Models\Asset;

class AssetAccessToken
{
    public function issue(Asset $asset, int $ttlSeconds = 900): string
    {
        $payload = $asset->id.'.'.(time() + $ttlSeconds);
        $signature = hash_hmac('sha256', $payload, config('app.key'));

        return rtrim(strtr(base64_encode($payload.'.'.$signature), '+/', '-_'), '=');
    }

    public function valid(Asset $asset, ?string $token): bool
    {
        if (! $token) {
            return false;
        }
        $decoded = base64_decode(strtr($token, '-_', '+/'), true);
        if (! $decoded) {
            return false;
        }
        $parts = explode('.', $decoded);
        if (count($parts) !== 3) {
            return false;
        }
        [$assetId, $expires, $signature] = $parts;
        $payload = $assetId.'.'.$expires;

        return $assetId === $asset->id
            && ctype_digit($expires)
            && (int) $expires >= time()
            && hash_equals(hash_hmac('sha256', $payload, config('app.key')), $signature);
    }
}
