<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CreditLedger extends Model
{
    public $timestamps = false;

    protected $table = 'credit_ledger';

    protected $fillable = ['user_id', 'job_id', 'type', 'amount', 'balance_after', 'idempotency_key', 'description', 'metadata', 'created_at'];

    protected function casts(): array
    {
        return ['amount' => 'integer', 'balance_after' => 'integer', 'metadata' => 'array', 'created_at' => 'datetime'];
    }
}
