<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\FirebaseTokenVerifier;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
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
        } catch (Throwable $error) {
            report($error);

            return new JsonResponse(['message' => 'El token de Firebase no es válido.'], 401);
        }

        $user = User::query()->updateOrCreate(['firebase_uid' => $identity['uid']], [
            'email' => $identity['email'],
            'name' => $identity['name'],
            'avatar_url' => $identity['picture'],
            'email_verified_at' => $identity['email_verified'] ? now() : null,
            'last_login_at' => now(),
        ]);
        if ($user->wasRecentlyCreated) {
            $user->forceFill(['credit_balance' => config('altura.initial_credits')])->save();
        }

        auth()->setUser($user);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
