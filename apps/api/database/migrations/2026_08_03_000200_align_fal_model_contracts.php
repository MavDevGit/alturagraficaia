<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        DB::table('tool_settings')
            ->where('tool', 'background-remover')
            ->update([
                'provider' => 'fal',
                'model' => 'fal-ai/bria/background/remove',
                'settings' => null,
                'updated_at' => now(),
            ]);
    }

    public function down(): void
    {
        DB::table('tool_settings')
            ->where('tool', 'background-remover')
            ->update([
                'model' => 'fal-ai/birefnet',
                'updated_at' => now(),
            ]);
    }
};
