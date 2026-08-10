<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        DB::table('tool_settings')->insertOrIgnore([
            [
                'tool' => 'upscaler',
                'provider' => 'fal',
                'model' => 'fal-ai/seedvr/upscale/image',
                'base_credits' => 1,
                'enabled' => true,
                'settings' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'tool' => 'background-remover',
                'provider' => 'fal',
                'model' => 'fal-ai/bria/background/remove',
                'base_credits' => 2,
                'enabled' => true,
                'settings' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'tool' => 'outpainting',
                'provider' => 'fal',
                'model' => 'fal-ai/flux-2-pro/outpaint',
                'base_credits' => 4,
                'enabled' => true,
                'settings' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        DB::table('tool_settings')
            ->whereIn('tool', ['upscaler', 'background-remover', 'outpainting'])
            ->delete();
    }
};
