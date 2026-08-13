<?php

namespace App\Services;

use App\Models\Asset;

class AssetAccessToken
{
    public function issue(Asset $asset, int $ttlSeconds = 900, string $purpose = 'content'): string
    {
        $expires = time() + $ttlSeconds;
        $payload = $asset->id.'.'.$expires.'.'.$purpose;
        $signature = hash_hmac('sha256', $payload, config('app.key'));

        return rtrim(strtr(base64_encode($asset->id.'.'.$expires.'.'.$signature), '+/', '-_'), '=');
    }

    public function valid(Asset $asset, ?string $token, string $purpose = 'content'): bool
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
        $payload = $assetId.'.'.$expires.'.'.$purpose;

        return $assetId === $asset->id
            && ctype_digit($expires)
            && (int) $expires >= time()
            && hash_equals(hash_hmac('sha256', $payload, config('app.key')), $signature);
    }
}
