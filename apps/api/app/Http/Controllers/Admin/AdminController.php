<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ToolSetting;
use App\Models\User;
use App\Services\CreditService;
use App\Services\QuotaService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function users(): JsonResponse
    {
        return response()->json(User::query()->latest()->paginate(50, ['id', 'name', 'email', 'role', 'credit_balance', 'last_login_at']));
    }

    public function credits(Request $request, User $user, CreditService $credits): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'integer', 'between:-100000,100000', 'not_in:0'],
            'reason' => ['required', 'string', 'max:500'],
            'idempotency_key' => ['required', 'string', 'max:100'],
        ]);
        $updated = $credits->adjust($user, $data['amount'], $data['reason'], $data['idempotency_key']);

        return response()->json(['id' => $updated->id, 'credit_balance' => $updated->credit_balance]);
    }

    public function models(): JsonResponse
    {
        return response()->json(['data' => ToolSetting::query()->orderBy('tool')->get()]);
    }

    public function updateModel(Request $request, ToolSetting $toolSetting): JsonResponse
    {
        $models = [
            'upscaler' => 'fal-ai/seedvr/upscale/image',
            'background-remover' => 'fal-ai/bria/background/remove',
            'outpainting' => 'fal-ai/flux-2-pro/outpaint',
        ];
        $data = $request->validate([
            'provider' => ['sometimes', Rule::in(['fal'])],
            'model' => ['sometimes', Rule::in([$models[$toolSetting->tool]])],
            'base_credits' => ['sometimes', 'integer', 'between:0,1000'],
            'enabled' => ['sometimes', 'boolean'],
            'settings' => ['sometimes', 'nullable', 'array'],
        ]);
        $toolSetting->update($data);

        return response()->json($toolSetting->fresh());
    }

    public function quotas(QuotaService $quotas): JsonResponse
    {
        return response()->json(['data' => $quotas->current()]);
    }

    public function secrets(): JsonResponse
    {
        return response()->json(['data' => [
            ['name' => 'FAL_KEY', ...config('altura.secret_status.fal')],
        ]]);
    }
}
