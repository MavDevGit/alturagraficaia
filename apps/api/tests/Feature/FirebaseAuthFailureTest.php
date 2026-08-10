<?php

use App\Models\User;
use App\Services\FirebaseTokenVerifier;
use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;
use Kreait\Firebase\Exception\Auth\UserNotFound;

it('reports an invalid Firebase token as an authentication failure', function (): void {
    $verifier = Mockery::mock(FirebaseTokenVerifier::class);
    $verifier->shouldReceive('verify')
        ->once()
        ->with('invalid-token')
        ->andThrow(new FailedToVerifyToken('Invalid token'));
    $this->app->instance(FirebaseTokenVerifier::class, $verifier);

    $this->getJson('/api/v1/me', ['Authorization' => 'Bearer invalid-token'])
        ->assertUnauthorized()
        ->assertJsonPath('message', 'El token de Firebase no es válido.');

    expect(User::query()->count())->toBe(0);
});

it('reports a deleted Firebase account as an authentication failure', function (): void {
    $verifier = Mockery::mock(FirebaseTokenVerifier::class);
    $verifier->shouldReceive('verify')
        ->once()
        ->andThrow(new UserNotFound('User not found'));
    $this->app->instance(FirebaseTokenVerifier::class, $verifier);

    $this->getJson('/api/v1/me', ['Authorization' => 'Bearer deleted-user-token'])
        ->assertUnauthorized()
        ->assertJsonPath('message', 'La cuenta de Firebase ya no existe.');
});

it('reports an upstream Firebase outage as a retryable service failure', function (): void {
    $verifier = Mockery::mock(FirebaseTokenVerifier::class);
    $verifier->shouldReceive('verify')
        ->once()
        ->andThrow(new RuntimeException('Identity Toolkit unavailable'));
    $this->app->instance(FirebaseTokenVerifier::class, $verifier);

    $this->getJson('/api/v1/me', ['Authorization' => 'Bearer valid-looking-token'])
        ->assertStatus(503)
        ->assertHeader('Retry-After', '30')
        ->assertJsonPath(
            'message',
            'No se pudo validar la cuenta porque Firebase no está disponible. Intenta nuevamente.',
        );
});
