<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Job extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'source_asset_id', 'result_asset_id', 'tool', 'status', 'credits',
        'settings', 'provider_job_id', 'error', 'started_at', 'finished_at',
    ];

    protected function casts(): array
    {
        return [
            'settings' => 'array', 'credits' => 'integer',
            'started_at' => 'datetime', 'finished_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sourceAsset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'source_asset_id');
    }

    public function resultAsset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'result_asset_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(JobEvent::class);
    }
}
