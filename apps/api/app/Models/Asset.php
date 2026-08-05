<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Asset extends Model
{
    use HasUuids;

    protected $fillable = [
        'user_id', 'kind', 'status', 'storage_disk', 'storage_path', 'tile_prefix',
        'original_name', 'mime_type', 'byte_size', 'quota_bytes', 'width', 'height', 'tile_size',
        'overlap', 'max_level', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'byte_size' => 'integer', 'quota_bytes' => 'integer', 'width' => 'integer', 'height' => 'integer',
            'tile_size' => 'integer', 'overlap' => 'integer', 'max_level' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
