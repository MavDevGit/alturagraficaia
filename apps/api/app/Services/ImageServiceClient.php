<?php

namespace App\Services;

use Google\Auth\Credentials\GCECredentials;
use App\Models\Asset;
use App\Models\Job;
use App\Models\ToolSetting;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class ImageServiceClient
{
    private static ?string $idToken = null;

    private static int $idTokenExpiresAt = 0;

    public function submit(Job $job): string
    {
        $job->loadMissing(['sourceAsset', 'resultAsset']);
        $response = $this->client()->timeout(45)->post('/v1/jobs', [
            'jobId' => $job->id,
            'tool' => str_replace('-', '_', $job->tool),
            'modelId' => $this->modelFor($job->tool),
            'input' => $job->settings ?? [],
            'sourceObject' => $job->sourceAsset->storage_path,
            'sourcePyramidPrefix' => "tiles/{$job->sourceAsset->id}",
            'resultObject' => $job->resultAsset->storage_path,
            'resultPyramidPrefix' => "tiles/{$job->resultAsset->id}",
            'outputFormat' => $job->settings['format'] ?? 'png',
        ])->throw();

        return (string) $response->json('providerRequestId');
    }

    /** @return array<string,mixed> */
    public function pyramid(Asset $asset): array
    {
        return $this->client()->timeout(900)->post('/v1/pyramids', [
            'jobId' => (string) Str::uuid(),
            'assetId' => $asset->id,
            'source' => $asset->storage_path,
            'destinationPrefix' => "tiles/{$asset->id}",
        ])->throw()->json();
    }

    public function cancel(Job $job): void
    {
        $this->client()->timeout(20)->post("/v1/jobs/{$job->id}/cancel")->throw();
    }

    private function client(): PendingRequest
    {
        $client = Http::baseUrl(config('altura.image_service_url'))
            ->withHeader('X-Internal-Key', config('altura.image_service_key'))
            ->acceptJson()->asJson()->connectTimeout(10)->retry(2, 250);

        if ($audience = config('altura.image_service_audience')) {
            $client = $client->withHeader('X-Serverless-Authorization', 'Bearer '.$this->idToken($audience));
        }

        return $client;
    }

    private function idToken(string $audience): string
    {
        if (self::$idToken && self::$idTokenExpiresAt > time() + 60) {
            return self::$idToken;
        }
        $credentials = new GCECredentials(targetAudience: $audience);
        $token = $credentials->fetchAuthToken()['id_token'] ?? null;
        if (! is_string($token) || $token === '') {
            throw new \RuntimeException('No se pudo obtener la identidad para invocar Cloud Run.');
        }
        $parts = explode('.', $token);
        $encodedClaims = $parts[1] ?? '';
        $encodedClaims .= str_repeat('=', (4 - strlen($encodedClaims) % 4) % 4);
        $decodedClaims = base64_decode(strtr($encodedClaims, '-_', '+/'), true);
        $claims = $decodedClaims !== false ? json_decode($decodedClaims, true) : null;
        self::$idToken = $token;
        self::$idTokenExpiresAt = is_array($claims) ? (int) ($claims['exp'] ?? time() + 3000) : time() + 3000;

        return $token;
    }

    private function modelFor(string $tool): string
    {
        $setting = ToolSetting::query()->where('tool', $tool)->where('enabled', true)->first();
        if (! $setting) {
            throw new \InvalidArgumentException('Herramienta no soportada o deshabilitada.');
        }

        return $setting->model;
    }
}
