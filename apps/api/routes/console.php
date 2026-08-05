<?php

use App\Models\Asset;
use App\Models\Job;
use App\Models\User;
use App\Services\CreditService;
use App\Services\QuotaService;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Storage;

Artisan::command('users:import-firestore {--source= : JSON exportado de Firestore} {--dry-run}', function (): int {
    $source = $this->option('source');
    if (! $source || ! is_file($source)) {
        $this->error('Indique --source con un JSON exportado de Firestore.');

        return 1;
    }
    $rows = json_decode(file_get_contents($source), true, flags: JSON_THROW_ON_ERROR);
    $this->info('Registros detectados: '.count($rows));
    foreach ($rows as $row) {
        $data = [
            'firebase_uid' => $row['firebase_uid'] ?? $row['uid'] ?? null,
            'email' => $row['email'] ?? null,
            'name' => $row['name'] ?? $row['displayName'] ?? null,
            'role' => $row['role'] ?? 'user',
            'credit_balance' => (int) ($row['credits'] ?? $row['credit_balance'] ?? 0),
        ];
        if (! $data['firebase_uid'] || ! $data['email']) {
            $this->warn('Registro omitido por UID/correo faltante.');

            continue;
        }
        $this->line("{$data['firebase_uid']} · {$data['email']} · {$data['credit_balance']} créditos");
        if (! $this->option('dry-run')) {
            User::query()->updateOrCreate(['firebase_uid' => $data['firebase_uid']], $data);
        }
    }
    $this->info($this->option('dry-run') ? 'Simulación finalizada; no se escribió nada.' : 'Importación finalizada.');

    return 0;
})->purpose('Importa perfiles, roles y saldos exportados de Firestore sin migrar contraseñas');

Artisan::command('users:promote-admin {identity? : Correo o Firebase UID} {--first : Promueve al primer usuario registrado}', function (): int {
    $identity = $this->argument('identity');
    if (! $identity && ! $this->option('first')) {
        $this->error('Indique un correo/UID o use --first.');

        return 1;
    }

    $user = $this->option('first')
        ? User::query()->where('firebase_uid', '!=', 'local-admin')->oldest('created_at')->oldest('id')->first()
        : User::query()->where('email', $identity)->orWhere('firebase_uid', $identity)->first();
    if (! $user) {
        $this->error('No se encontró el usuario solicitado. Primero debe iniciar sesión una vez.');

        return 1;
    }

    $user->forceFill(['role' => 'admin'])->save();
    $this->info("Administrador habilitado: {$user->email} ({$user->firebase_uid})");

    return 0;
})->purpose('Promueve de forma explícita un usuario existente al rol administrador');

Artisan::command('assets:purge-expired', function (): void {
    Asset::query()->where('expires_at', '<=', now())->where('status', '!=', 'expired')->chunkById(100, function ($assets): void {
        foreach ($assets as $asset) {
            Storage::disk($asset->storage_disk)->delete($asset->storage_path);
            if ($asset->tile_prefix) {
                Storage::disk($asset->storage_disk)->deleteDirectory($asset->tile_prefix);
            }
            app(QuotaService::class)->releaseAsset($asset);
            $asset->update(['status' => 'expired']);
        }
    });
})->purpose('Elimina originales, resultados y mosaicos vencidos');

Artisan::command('jobs:fail-stale', function (): void {
    $cutoff = now()->subMinutes(config('altura.job_stale_minutes'));
    Job::query()
        ->whereIn('status', ['queued', 'processing', 'tiling'])
        ->where('updated_at', '<=', $cutoff)
        ->pluck('id')
        ->each(function (string $jobId) use ($cutoff): void {
            DB::transaction(function () use ($jobId, $cutoff): void {
                $job = Job::query()->with('resultAsset')->lockForUpdate()->find($jobId);
                if (! $job || ! in_array($job->status, ['queued', 'processing', 'tiling'], true) || $job->updated_at->isAfter($cutoff)) {
                    return;
                }
                $job->update([
                    'status' => 'failed',
                    'error' => 'El trabajo excediÃ³ el tiempo mÃ¡ximo de finalizaciÃ³n.',
                    'finished_at' => now(),
                ]);
                app(CreditService::class)->refund($job, 'El trabajo excediÃ³ el tiempo mÃ¡ximo de finalizaciÃ³n.');
                if ($job->resultAsset) {
                    app(QuotaService::class)->releaseAsset($job->resultAsset);
                    $job->resultAsset->update(['status' => 'failed']);
                }
                $job->events()->create(['type' => 'failed_stale', 'created_at' => now()]);
            }, 3);
        });
})->purpose('Cierra y reembolsa trabajos sin actividad despuÃ©s del lÃ­mite operativo');

Schedule::command('assets:purge-expired')->hourly()->withoutOverlapping();
Schedule::command('jobs:fail-stale')->hourly()->withoutOverlapping();
Schedule::command('queue:prune-failed --hours=168')->daily();
