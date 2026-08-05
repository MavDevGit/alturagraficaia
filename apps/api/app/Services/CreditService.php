<?php

namespace App\Services;

use App\Models\CreditLedger;
use App\Models\Job;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CreditService
{
    public function reserve(User $user, Job $job, int $amount): void
    {
        DB::transaction(function () use ($user, $job, $amount): void {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            if ($locked->credit_balance < $amount) {
                throw ValidationException::withMessages(['credits' => 'Créditos insuficientes.']);
            }
            $locked->decrement('credit_balance', $amount);
            $this->record($locked, $job, 'reservation', -$amount, "reserve:{$job->id}");
        }, 3);
    }

    public function confirm(Job $job): void
    {
        DB::transaction(function () use ($job): void {
            $user = User::query()->lockForUpdate()->findOrFail($job->user_id);
            $this->record($user, $job, 'capture', 0, "capture:{$job->id}");
        }, 3);
    }

    public function refund(Job $job, string $reason): void
    {
        DB::transaction(function () use ($job, $reason): void {
            $key = "refund:{$job->id}";
            if (CreditLedger::query()->where('idempotency_key', $key)->exists()) {
                return;
            }
            $user = User::query()->lockForUpdate()->findOrFail($job->user_id);
            $user->increment('credit_balance', $job->credits);
            $this->record($user->fresh(), $job, 'refund', $job->credits, $key, $reason);
        }, 3);
    }

    public function adjust(User $user, int $amount, string $reason, string $idempotencyKey): User
    {
        return DB::transaction(function () use ($user, $amount, $reason, $idempotencyKey): User {
            $locked = User::query()->lockForUpdate()->findOrFail($user->id);
            $existing = CreditLedger::query()->where('idempotency_key', $idempotencyKey)->first();
            if ($existing) {
                if ($existing->user_id !== $locked->id || $existing->amount !== $amount || $existing->description !== $reason) {
                    throw ValidationException::withMessages([
                        'idempotency_key' => 'La clave de idempotencia ya fue utilizada para otro ajuste.',
                    ]);
                }

                return $locked;
            }
            if ($locked->credit_balance + $amount < 0) {
                throw ValidationException::withMessages(['amount' => 'El ajuste dejaría un saldo negativo.']);
            }
            $locked->increment('credit_balance', $amount);
            $this->record($locked->fresh(), null, 'adjustment', $amount, $idempotencyKey, $reason);

            return $locked->fresh();
        }, 3);
    }

    private function record(User $user, ?Job $job, string $type, int $amount, string $key, ?string $description = null): void
    {
        CreditLedger::query()->firstOrCreate(['idempotency_key' => $key], [
            'user_id' => $user->id,
            'job_id' => $job?->id,
            'type' => $type,
            'amount' => $amount,
            'balance_after' => $user->credit_balance,
            'description' => $description,
            'created_at' => now(),
        ]);
    }
}
