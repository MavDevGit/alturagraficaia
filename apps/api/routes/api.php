<?php

use App\Http\Controllers\Admin\AdminController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\Internal\ImageCallbackController;
use App\Http\Controllers\JobController;
use App\Http\Controllers\UploadController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::post('/internal/image-callback', ImageCallbackController::class)
    ->middleware('throttle:image-callback')
    ->name('internal.image-callback');

Route::prefix('v1')->group(function (): void {
    Route::get('/assets/{asset}/tiles/{level}/{tile}', [AssetController::class, 'tile'])->whereNumber('level')->name('assets.tile');
    Route::middleware('firebase')->group(function (): void {
        Route::get('/me', fn (Request $request) => $request->user()->only(['id', 'name', 'email', 'role', 'credit_balance', 'avatar_url']));
        Route::post('/uploads', UploadController::class)->middleware('throttle:uploads');
        Route::get('/jobs', [JobController::class, 'index']);
        Route::post('/jobs', [JobController::class, 'store'])->middleware('throttle:jobs');
        Route::get('/jobs/{job}', [JobController::class, 'show']);
        Route::post('/jobs/{job}/cancel', [JobController::class, 'cancel']);
        Route::get('/assets/{asset}/viewer', [AssetController::class, 'viewer'])->name('assets.viewer');
        Route::get('/assets/{asset}/download', [AssetController::class, 'download'])->name('assets.download');

        Route::prefix('admin')->middleware(['admin', 'throttle:admin'])->group(function (): void {
            Route::get('/users', [AdminController::class, 'users']);
            Route::post('/users/{user}/credits', [AdminController::class, 'credits']);
            Route::get('/models', [AdminController::class, 'models']);
            Route::put('/models/{toolSetting}', [AdminController::class, 'updateModel']);
            Route::get('/secrets/status', [AdminController::class, 'secrets']);
            Route::get('/quotas', [AdminController::class, 'quotas']);
        });
    });
});
