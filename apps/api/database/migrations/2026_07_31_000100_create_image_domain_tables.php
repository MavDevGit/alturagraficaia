<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('assets', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind')->index();
            $table->string('status')->default('pending')->index();
            $table->string('storage_disk')->default('local');
            $table->string('storage_path');
            $table->string('tile_prefix')->nullable();
            $table->string('original_name')->nullable();
            $table->string('mime_type');
            $table->unsignedBigInteger('byte_size');
            $table->unsignedBigInteger('quota_bytes')->default(0);
            $table->unsignedInteger('width');
            $table->unsignedInteger('height');
            $table->unsignedSmallInteger('tile_size')->default(512);
            $table->unsignedTinyInteger('overlap')->default(1);
            $table->unsignedSmallInteger('max_level')->nullable();
            $table->timestamp('expires_at')->nullable()->index();
            $table->timestamps();
        });

        Schema::create('jobs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('source_asset_id')->constrained('assets')->cascadeOnDelete();
            $table->foreignUuid('result_asset_id')->nullable()->constrained('assets')->nullOnDelete();
            $table->string('tool')->index();
            $table->string('status')->default('queued')->index();
            $table->unsignedInteger('credits');
            $table->json('settings')->nullable();
            $table->string('provider_job_id')->nullable()->index();
            $table->text('error')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('finished_at')->nullable();
            $table->timestamps();
        });

        Schema::create('job_events', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignUuid('job_id')->constrained()->cascadeOnDelete();
            $table->string('type')->index();
            $table->json('payload')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('credit_ledger', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->foreignUuid('user_id')->constrained()->cascadeOnDelete();
            $table->foreignUuid('job_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type')->index();
            $table->bigInteger('amount');
            $table->bigInteger('balance_after');
            $table->string('idempotency_key')->unique();
            $table->text('description')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('tool_settings', function (Blueprint $table): void {
            $table->id();
            $table->string('tool')->unique();
            $table->string('provider')->default('fal');
            $table->string('model');
            $table->unsignedInteger('base_credits')->default(1);
            $table->boolean('enabled')->default(true);
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        Schema::create('usage_quotas', function (Blueprint $table): void {
            $table->id();
            $table->string('resource');
            $table->date('period_start');
            $table->unsignedBigInteger('used')->default(0);
            $table->unsignedBigInteger('soft_limit');
            $table->unsignedBigInteger('hard_limit');
            $table->timestamps();
            $table->unique(['resource', 'period_start']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_quotas');
        Schema::dropIfExists('tool_settings');
        Schema::dropIfExists('credit_ledger');
        Schema::dropIfExists('job_events');
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('assets');
    }
};
