<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Asset extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'kind', 'status', 'external_url', 'original_name', 'mime_type',
        'byte_size', 'width', 'height', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'byte_size' => 'integer', 'width' => 'integer', 'height' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
