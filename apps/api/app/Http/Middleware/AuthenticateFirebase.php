<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\FirebaseTokenVerifier;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Kreait\Firebase\Exception\Auth\FailedToVerifyToken;
use Kreait\Firebase\Exception\Auth\UserNotFound;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class AuthenticateFirebase
{
    public function __construct(private readonly FirebaseTokenVerifier $verifier) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if (! $token) {
            return new JsonResponse(['message' => 'Falta el token de Firebase.'], 401);
        }

        try {
            $identity = $this->verifier->verify($token);
        } catch (FailedToVerifyToken $error) {
            report($error);

            return new JsonResponse(['message' => 'El token de Firebase no es válido.'], 401);
        } catch (UserNotFound $error) {
            report($error);

            return new JsonResponse(['message' => 'La cuenta de Firebase ya no existe.'], 401);
        } catch (Throwable $error) {
            report($error);

            return new JsonResponse([
                'message' => 'No se pudo validar la cuenta porque Firebase no está disponible. Intenta nuevamente.',
            ], 503, ['Retry-After' => '30']);
        }

        $now = now();
        User::query()->upsert([[
            'id' => (string) Str::uuid(),
            'firebase_uid' => $identity['uid'],
            'email' => $identity['email'],
            'name' => $identity['name'],
            'avatar_url' => $identity['picture'],
            'email_verified_at' => $identity['email_verified'] ? $now : null,
            'role' => 'user',
            'credit_balance' => config('altura.initial_credits'),
            'last_login_at' => $now,
            'created_at' => $now,
            'updated_at' => $now,
        ]], ['firebase_uid'], [
            'email', 'name', 'avatar_url', 'email_verified_at', 'last_login_at',
            'updated_at',
        ]);
        $user = User::query()->where('firebase_uid', $identity['uid'])->firstOrFail();

        auth()->setUser($user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
