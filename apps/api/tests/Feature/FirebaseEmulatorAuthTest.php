<?php

use App\Models\User;
use Illuminate\Support\Facades\Http;

it('resolves an emulator token to the matching PostgreSQL administrator', function (): void {
    config()->set('altura.auth_driver', 'firebase');
    config()->set('altura.firebase_project_id', 'altura-grafica-ia');
    config()->set('altura.firebase_emulator_host', '127.0.0.1:9099');

    $uid = 'firebase-admin-uid';
    User::query()->create([
        'firebase_uid' => $uid,
        'email' => 'admin@example.test',
        'name' => 'Admin',
        'role' => 'admin',
        'credit_balance' => 20,
    ]);
    Http::fake([
        'http://127.0.0.1:9099/*' => Http::response(['users' => [[
            'localId' => $uid,
            'email' => 'admin@example.test',
            'displayName' => 'Admin',
            'emailVerified' => true,
        ]]]),
    ]);

    $encode = fn (array $value): string => rtrim(strtr(base64_encode(json_encode($value, JSON_THROW_ON_ERROR)), '+/', '-_'), '=');
    $token = $encode(['alg' => 'none', 'typ' => 'JWT']).'.'.$encode([
        'aud' => 'altura-grafica-ia',
        'iss' => 'https://securetoken.google.com/altura-grafica-ia',
        'sub' => $uid,
        'exp' => time() + 3600,
    ]).'.';

    $this->getJson('/api/v1/me', ['Authorization' => "Bearer {$token}"])
        ->assertOk()
        ->assertJsonPath('email', 'admin@example.test')
        ->assertJsonPath('role', 'admin');

    Http::assertSent(fn ($request): bool => $request->url() === 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:lookup?key=emulator'
        && ! $request->hasHeader('Authorization')
        && $request['idToken'] === $token);
});
