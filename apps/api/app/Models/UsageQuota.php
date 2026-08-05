<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UsageQuota extends Model
{
    protected $fillable = ['resource', 'period_start', 'used', 'soft_limit', 'hard_limit'];

    protected function casts(): array
    {
        return [
            'period_start' => 'date',
            'used' => 'integer',
            'soft_limit' => 'integer',
            'hard_limit' => 'integer',
        ];
    }
}
