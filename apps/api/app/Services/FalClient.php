<?php

namespace App\Services;

use App\Models\Job;
use App\Models\ToolSetting;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use InvalidArgumentException;
use RuntimeException;

class FalClient
{
    public function __construct(private readonly FalProxyClient $proxy) {}

    /** @return array{upload_url:string,file_url:string} */
    public function initiateUpload(string $fileName, string $mimeType): array
    {
        $payload = ['file_name' => $fileName, 'content_type' => $mimeType];
        $headers = ['X-Fal-Object-Lifecycle-Preference' => $this->lifecycleHeader()];
        $response = $this->proxy->configured()
            ? $this->proxy->request(
                'POST',
                '/v1/rest-alpha/storage/upload/initiate?storage_type=fal-cdn-v3',
                $payload,
                $headers,
            )->throw()->json()
            : $this->client()->withHeaders($headers)
                ->post('https://rest.alpha.fal.ai/storage/upload/initiate?storage_type=fal-cdn-v3', $payload)
                ->throw()->json();

        $uploadUrl = $response['upload_url'] ?? null;
        $fileUrl = $response['file_url'] ?? null;
        if (! is_string($uploadUrl) || ! str_starts_with($uploadUrl, 'https://')) {
            throw new RuntimeException('FAL no devolvió una URL de carga segura.');
        }
        if (! is_string($fileUrl) || ! $this->isMediaUrl($fileUrl)) {
            throw new RuntimeException('FAL no devolvió una URL de archivo permitida.');
        }

        return ['upload_url' => $uploadUrl, 'file_url' => $fileUrl];
    }

    public function submit(Job $job): string
    {
        $job->loadMissing(['sourceAsset', 'resultAsset']);
        $sourceUrl = $job->sourceAsset?->external_url;
        if (! is_string($sourceUrl) || ! $this->isMediaUrl($sourceUrl)) {
            throw new RuntimeException('El original temporal de FAL no está disponible.');
        }

        $model = $this->modelFor($job->tool);
        $webhook = route('fal.webhook', ['job_id' => $job->id]);
        $query = '?fal_webhook='.rawurlencode($webhook);
        $payload = $this->modelInput($job, $sourceUrl);
        $headers = ['X-Fal-Object-Lifecycle-Preference' => $this->lifecycleHeader()];
        $response = $this->proxy->configured()
            ? $this->proxy->request('POST', '/v1/queue/'.$model.$query, $payload, $headers)->throw()->json()
            : $this->client()->withHeaders($headers)
                ->post('https://queue.fal.run/'.$model.$query, $payload)->throw()->json();
        $requestId = $response['request_id'] ?? null;
        if (! is_string($requestId) || $requestId === '') {
            throw new RuntimeException('FAL no devolvió request_id.');
        }

        return $requestId;
    }

    public function cancel(Job $job): void
    {
        if (! $job->provider_job_id) {
            return;
        }
        $model = $this->queueModelId($this->modelFor($job->tool));
        $path = $model.'/requests/'.rawurlencode($job->provider_job_id).'/cancel';
        $response = $this->proxy->configured()
            ? $this->proxy->request('PUT', '/v1/queue/'.$path)
            : $this->client()->put('https://queue.fal.run/'.$path);
        if (! in_array($response->status(), [202, 400, 404], true)) {
            $response->throw();
        }
    }

    public function isMediaUrl(string $url): bool
    {
        $host = strtolower((string) parse_url($url, PHP_URL_HOST));
        $scheme = strtolower((string) parse_url($url, PHP_URL_SCHEME));

        return $scheme === 'https' && ($host === 'fal.media' || str_ends_with($host, '.fal.media'));
    }

    private function client(): PendingRequest
    {
        $key = (string) config('altura.fal_key');
        if ($key === '') {
            throw new RuntimeException('FAL_KEY no está configurada.');
        }

        return Http::withHeader('Authorization', 'Key '.$key)
            ->acceptJson()->asJson()->connectTimeout(5)->timeout(30)->retry(2, 250);
    }

    private function lifecycleHeader(): string
    {
        return json_encode([
            'expiration_duration_seconds' => config('altura.asset_ttl_days') * 86400,
        ], JSON_THROW_ON_ERROR);
    }

    private function modelFor(string $tool): string
    {
        $setting = ToolSetting::query()->where('tool', $tool)->where('enabled', true)->first();
        if (! $setting) {
            throw new InvalidArgumentException('Herramienta no soportada o deshabilitada.');
        }

        return $setting->model;
    }

    private function queueModelId(string $model): string
    {
        $parts = explode('/', $model);
        if (count($parts) < 2) {
            throw new InvalidArgumentException('Identificador FAL inválido.');
        }

        return $parts[0].'/'.$parts[1];
    }

    /** @return array<string,mixed> */
    private function modelInput(Job $job, string $sourceUrl): array
    {
        $input = $job->settings ?? [];
        if ($job->tool === 'upscaler') {
            $mode = ($input['upscaleMode'] ?? 'factor') === 'target' ? 'target' : 'factor';

            return array_filter([
                'image_url' => $sourceUrl,
                'upscale_mode' => $mode,
                'upscale_factor' => $mode === 'factor' ? max(1, min(10, (float) ($input['scale'] ?? 2))) : null,
                'target_resolution' => $mode === 'target' ? ($input['targetResolution'] ?? '1080p') : null,
                'noise_scale' => max(0, min(1, (float) ($input['fidelity'] ?? 0.1))),
                'output_format' => ($input['format'] ?? 'png') === 'jpeg' ? 'jpg' : ($input['format'] ?? 'png'),
                'sync_mode' => false,
            ], fn (mixed $value): bool => $value !== null);
        }

        if ($job->tool === 'background-remover') {
            return ['image_url' => $sourceUrl, 'sync_mode' => false];
        }

        return [
            'image_url' => $sourceUrl,
            'expand_top' => max(0, (int) ($input['expandTop'] ?? 256)),
            'expand_bottom' => max(0, (int) ($input['expandBottom'] ?? 256)),
            'expand_left' => max(0, (int) ($input['expandLeft'] ?? 256)),
            'expand_right' => max(0, (int) ($input['expandRight'] ?? 256)),
            'auto_crop' => false,
            'mode' => ($input['mode'] ?? 'high') === 'fast' ? 'fast' : 'high',
            'enable_safety_checker' => true,
            'output_format' => ($input['format'] ?? 'png') === 'jpeg' ? 'jpeg' : 'png',
            'sync_mode' => false,
        ];
    }
}
