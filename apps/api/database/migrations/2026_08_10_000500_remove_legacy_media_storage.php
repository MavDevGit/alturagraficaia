<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('assets', 'external_url')) {
            Schema::table('assets', function (Blueprint $table): void {
                $table->text('external_url')->nullable();
            });
        }

        DB::table('assets')->whereNull('external_url')->update(['status' => 'expired']);
        DB::table('usage_quotas')->where('resource', '!=', 'image_jobs')->delete();

        $legacy = collect([
            'storage_disk', 'storage_path', 'tile_prefix', 'quota_bytes',
            'tile_size', 'overlap', 'max_level',
        ])->filter(fn (string $column): bool => Schema::hasColumn('assets', $column))->all();
        if ($legacy !== []) {
            Schema::table('assets', function (Blueprint $table) use ($legacy): void {
                $table->dropColumn($legacy);
            });
        }
    }

    public function down(): void
    {
        // Irreversible: media files and their obsolete columns are intentionally removed.
    }
};
