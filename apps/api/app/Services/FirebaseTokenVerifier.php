<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Kreait\Firebase\JWT\Error\IdTokenVerificationFailed;
use Kreait\Firebase\JWT\IdTokenVerifier;
use RuntimeException;

class FirebaseTokenVerifier
{
    private ?IdTokenVerifier $verifier = null;

    /** @return array{uid:string,email:string,name:?string,picture:?string,email_verified:bool} */
    public function verify(string $token): array
    {
        if (config('altura.auth_driver') === 'local') {
            if (app()->isProduction() || ! str_starts_with($token, 'local:')) {
                throw new RuntimeException('Token local no permitido.');
            }
            $uid = substr($token, 6);
            if ($uid === '') {
                throw new RuntimeException('Token local invalido.');
            }

            return [
                'uid' => $uid,
                'email' => "{$uid}@local.alturagrafica.test",
                'name' => 'Cuenta local',
                'picture' => null,
                'email_verified' => true,
            ];
        }

        if ($host = config('altura.firebase_emulator_host')) {
            if (app()->isProduction()) {
                throw new RuntimeException('El emulador de Firebase no puede usarse en produccion.');
            }

            return $this->verifyEmulatorToken($token, $host);
        }

        try {
            $claims = $this->tokenVerifier()->verifyIdToken($token)->payload();
        } catch (IdTokenVerificationFailed $error) {
            throw new InvalidFirebaseToken('El token de Firebase no es valido.', previous: $error);
        }
        $uid = (string) ($claims['sub'] ?? $claims['user_id'] ?? '');
        if ($uid === '') {
            throw new InvalidFirebaseToken('El token de Firebase no identifica un usuario.');
        }

        return [
            'uid' => $uid,
            'email' => (string) ($claims['email'] ?? ''),
            'name' => isset($claims['name']) ? (string) $claims['name'] : null,
            'picture' => isset($claims['picture']) ? (string) $claims['picture'] : null,
            'email_verified' => (bool) ($claims['email_verified'] ?? false),
        ];
    }

    /** @return array{uid:string,email:string,name:?string,picture:?string,email_verified:bool} */
    private function verifyEmulatorToken(string $token, string $host): array
    {
        if (! preg_match('/^(127\.0\.0\.1|localhost):[0-9]{2,5}$/', $host)) {
            throw new RuntimeException('Host del emulador de Firebase no permitido.');
        }

        $parts = explode('.', $token);
        if (count($parts) !== 3) {
            throw new RuntimeException('Token del emulador invalido.');
        }
        $header = $this->decodeJwtPart($parts[0]);
        $claims = $this->decodeJwtPart($parts[1]);
        $project = config('altura.firebase_project_id');
        $uid = (string) ($claims['sub'] ?? $claims['user_id'] ?? '');
        if (
            ($header['alg'] ?? null) !== 'none'
            || ($claims['aud'] ?? null) !== $project
            || ($claims['iss'] ?? null) !== "https://securetoken.google.com/{$project}"
            || $uid === ''
            || (int) ($claims['exp'] ?? 0) <= time()
        ) {
            throw new RuntimeException('Las claims del emulador no son validas.');
        }

        $response = Http::timeout(5)
            ->post("http://{$host}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=emulator", [
                'idToken' => $token,
            ]);
        if (! $response->successful()) {
            throw new RuntimeException('El Auth Emulator rechazo el token.');
        }
        $firebaseUser = $response->json('users.0');
        if (! is_array($firebaseUser) || ($firebaseUser['localId'] ?? null) !== $uid) {
            throw new RuntimeException('El usuario no existe en el Auth Emulator.');
        }

        return [
            'uid' => $uid,
            'email' => (string) ($firebaseUser['email'] ?? $claims['email'] ?? ''),
            'name' => $firebaseUser['displayName'] ?? $claims['name'] ?? null,
            'picture' => $firebaseUser['photoUrl'] ?? $claims['picture'] ?? null,
            'email_verified' => (bool) ($firebaseUser['emailVerified'] ?? $claims['email_verified'] ?? false),
        ];
    }

    /** @return array<string,mixed> */
    private function decodeJwtPart(string $value): array
    {
        $decoded = base64_decode(strtr($value, '-_', '+/').str_repeat('=', (4 - strlen($value) % 4) % 4), true);
        if ($decoded === false) {
            throw new RuntimeException('Token del emulador mal codificado.');
        }
        $data = json_decode($decoded, true);
        if (! is_array($data)) {
            throw new RuntimeException('Token del emulador mal formado.');
        }

        return $data;
    }

    private function tokenVerifier(): IdTokenVerifier
    {
        return $this->verifier ??= IdTokenVerifier::createWithProjectId(
            (string) config('altura.firebase_project_id'),
        );
    }
}
