<?php

use App\Models\User;

it('promotes the first registered Firebase user and skips the local seed account', function (): void {
    User::factory()->create([
        'firebase_uid' => 'local-admin',
        'email' => 'admin@local.alturagrafica.test',
        'role' => 'admin',
        'created_at' => now()->subMinute(),
    ]);
    $registered = User::factory()->create([
        'firebase_uid' => 'firebase-first-user',
        'email' => 'first@example.com',
        'role' => 'user',
    ]);

    $this->artisan('users:promote-admin --first')
        ->expectsOutputToContain('Administrador habilitado: first@example.com')
        ->assertSuccessful();

    expect($registered->fresh()->role)->toBe('admin');
});
