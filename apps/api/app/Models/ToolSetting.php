<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ToolSetting extends Model
{
    protected $fillable = ['tool', 'provider', 'model', 'base_credits', 'enabled', 'settings'];

    protected function casts(): array
    {
        return ['enabled' => 'boolean', 'base_credits' => 'integer', 'settings' => 'array'];
    }
}
