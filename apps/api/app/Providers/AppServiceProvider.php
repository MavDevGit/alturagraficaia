<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
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
        RateLimiter::for('fal-webhook', fn (Request $request) => Limit::perMinute(180)
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
        $falKey = (string) config('altura.fal_key');
        if (strlen($falKey) < 16 || str_contains($falKey, 'change-me')) {
            $failures[] = 'FAL_KEY debe estar configurada únicamente en el servidor';
        }

        if ($failures !== []) {
            throw new LogicException('Configuración de producción insegura: '.implode('; ', $failures).'.');
        }
    }
}
