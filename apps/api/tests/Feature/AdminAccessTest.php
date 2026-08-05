<?php

use App\Models\User;

beforeEach(function (): void {
    config()->set('altura.auth_driver', 'local');
});

it('denies administrative endpoints to a regular user', function (): void {
    User::factory()->create(['firebase_uid' => 'regular-user', 'role' => 'user']);

    $this->getJson('/api/v1/admin/users', [
        'Authorization' => 'Bearer local:regular-user',
    ])->assertForbidden();
});

it('returns and preserves the administrator role after Firebase synchronization', function (): void {
    User::factory()->create(['firebase_uid' => 'firebase-admin', 'role' => 'admin']);
    $headers = ['Authorization' => 'Bearer local:firebase-admin'];

    $this->getJson('/api/v1/me', $headers)
        ->assertOk()
        ->assertJsonPath('role', 'admin');
    $this->getJson('/api/v1/admin/users', $headers)->assertOk();

    expect(User::query()->where('firebase_uid', 'firebase-admin')->value('role'))
        ->toBe('admin');
});

it('requires a nonzero idempotent administrative credit adjustment', function (): void {
    $admin = User::factory()->create(['firebase_uid' => 'credit-admin', 'role' => 'admin']);
    $target = User::factory()->create(['credit_balance' => 20]);
    $headers = ['Authorization' => 'Bearer local:credit-admin'];

    $this->postJson("/api/v1/admin/users/{$target->id}/credits", [
        'amount' => 0,
        'reason' => 'Sin cambio',
        'idempotency_key' => 'admin-test-zero',
    ], $headers)->assertUnprocessable();

    $payload = [
        'amount' => 5,
        'reason' => 'Prueba idempotente',
        'idempotency_key' => 'admin-test-adjustment',
    ];
    $this->postJson("/api/v1/admin/users/{$target->id}/credits", $payload, $headers)
        ->assertOk()
        ->assertJsonPath('credit_balance', 25);
    $this->postJson("/api/v1/admin/users/{$target->id}/credits", $payload, $headers)
        ->assertOk()
        ->assertJsonPath('credit_balance', 25);
});

it('reports only FAL secret metadata and never exposes the key', function (): void {
    config()->set('altura.secret_status.fal', [
        'configured' => true,
        'rotated_at' => '2026-08-03T12:00:00Z',
    ]);
    User::factory()->create(['firebase_uid' => 'secrets-admin', 'role' => 'admin']);

    $response = $this->getJson('/api/v1/admin/secrets/status', [
        'Authorization' => 'Bearer local:secrets-admin',
    ])->assertOk()
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.name', 'FAL_KEY')
        ->assertJsonPath('data.0.configured', true)
        ->assertJsonPath('data.0.rotated_at', '2026-08-03T12:00:00Z');

    expect($response->getContent())
        ->not->toContain('api_key')
        ->not->toContain('secret_value');
});
