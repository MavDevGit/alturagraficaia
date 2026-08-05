<?php

namespace Database\Seeders;

use App\Models\ToolSetting;
use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->firstOrCreate(['firebase_uid' => 'local-admin'], [
            'name' => 'Administrador local', 'email' => 'admin@local.alturagrafica.test',
            'email_verified_at' => now(), 'role' => 'admin', 'credit_balance' => 100,
        ]);
        foreach ([
            ['tool' => 'upscaler', 'model' => 'fal-ai/seedvr/upscale/image', 'base_credits' => 1],
            ['tool' => 'background-remover', 'model' => 'fal-ai/bria/background/remove', 'base_credits' => 2],
            ['tool' => 'outpainting', 'model' => 'fal-ai/flux-2-pro/outpaint', 'base_credits' => 4],
        ] as $setting) {
            ToolSetting::query()->updateOrCreate(['tool' => $setting['tool']], $setting);
        }
    }
}
