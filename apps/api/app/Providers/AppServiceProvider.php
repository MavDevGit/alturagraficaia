<?php

namespace App\Providers;

use Google\Cloud\Storage\StorageClient;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Filesystem\FilesystemAdapter;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\ServiceProvider;
use League\Flysystem\Filesystem;
use League\Flysystem\GoogleCloudStorage\GoogleCloudStorageAdapter;
use LogicException;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureRateLimits();
        $this->guardProductionConfiguration();

        Storage::extend('gcs', function ($app, array $config): FilesystemAdapter {
            $client = new StorageClient(array_filter([
                'projectId' => $config['project_id'],
                'keyFilePath' => $config['key_file'] ?? null,
            ]));
            $adapter = new GoogleCloudStorageAdapter($client->bucket($config['bucket']), $config['path_prefix'] ?? '');

            return new FilesystemAdapter(new Filesystem($adapter), $adapter, $config);
        });
    }

    private function configureRateLimits(): void
    {
        $response = fn (Request $request, array $headers) => response()->json([
            'message' => 'Demasiadas solicitudes. Espere un momento e intente nuevamente.',
        ], 429, $headers);
        $key = fn (Request $request): string => (string) ($request->user()?->id ?? $request->ip());

        RateLimiter::for('uploads', fn (Request $request) => Limit::perMinute(15)
            ->by($key($request))->response($response));
        RateLimiter::for('jobs', fn (Request $request) => Limit::perMinute(30)
            ->by($key($request))->response($response));
        RateLimiter::for('admin', fn (Request $request) => Limit::perMinute(120)
            ->by($key($request))->response($response));
        RateLimiter::for('image-callback', fn (Request $request) => Limit::perMinute(180)
            ->by((string) $request->ip())->response($response));
    }

    private function guardProductionConfiguration(): void
    {
        if (! app()->isProduction()) {
            return;
        }

        $failures = [];
        if ((bool) config('app.debug')) {
            $failures[] = 'APP_DEBUG debe estar desactivado';
        }
        if (! str_starts_with((string) config('app.url'), 'https://')) {
            $failures[] = 'APP_URL debe usar HTTPS';
        }
        if (! str_starts_with((string) config('app.key'), 'base64:')) {
            $failures[] = 'APP_KEY debe haberse generado con artisan key:generate';
        }
        if (config('database.default') !== 'pgsql') {
            $failures[] = 'PostgreSQL debe ser la base de datos de producciÃ³n';
        }
        if (config('queue.default') !== 'database') {
            $failures[] = 'La cola de producciÃ³n debe usar el controlador database';
        }
        if (config('altura.auth_driver') !== 'firebase' || config('altura.firebase_emulator_host')) {
            $failures[] = 'Firebase real debe ser el proveedor de autenticación';
        }
        if (config('filesystems.default') !== 'gcs' || ! config('filesystems.disks.gcs.bucket')) {
            $failures[] = 'FILESYSTEM_DISK=gcs y GCS_BUCKET son obligatorios';
        }
        if (! str_starts_with((string) config('altura.image_service_url'), 'https://')) {
            $failures[] = 'IMAGE_SERVICE_URL debe usar HTTPS';
        }
        if (! str_starts_with((string) config('altura.image_service_audience'), 'https://')) {
            $failures[] = 'IMAGE_SERVICE_AUDIENCE debe identificar el servicio privado de Cloud Run';
        }
        foreach (['image_service_key', 'callback_secret'] as $secret) {
            $value = (string) config("altura.{$secret}");
            if (strlen($value) < 32 || str_contains($value, 'change-me')) {
                $failures[] = "{$secret} debe contener un secreto de al menos 32 caracteres";
            }
        }

        if ($failures !== []) {
            throw new LogicException('Configuración de producción insegura: '.implode('; ', $failures).'.');
        }
    }
}
