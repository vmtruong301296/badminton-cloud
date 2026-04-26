<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\BracketController;
use App\Http\Controllers\Api\DebtController;
use App\Http\Controllers\Api\MenuController;
use App\Http\Controllers\Api\PartyBillController;
use App\Http\Controllers\Api\PaymentAccountController;
use App\Http\Controllers\Api\PermissionController;
use App\Http\Controllers\Api\PlayerController;
use App\Http\Controllers\Api\PlayerListController;
use App\Http\Controllers\Api\RatioController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ShuttleTypeController;
use App\Http\Controllers\Api\UserController;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;

// Authentication (Public routes)
Route::post('login', [AuthController::class, 'login']);
Route::post('logout', [AuthController::class, 'logout'])->middleware('auth');
Route::get('me', [AuthController::class, 'me'])->middleware('auth');

// Protected routes - require authentication
Route::middleware('auth')->group(function () {

    Route::get('/run-migrate-secret-123', function () {
        Artisan::call('migrate', ['--force' => true]);

        return 'Migrate done!';
    });

    Route::get('/clear/cache/123', function () {

        // Clear cache
        Artisan::call('cache:clear');

        // Clear & cache config
        Artisan::call('config:clear');

        // Clear & cache route
        Artisan::call('route:clear');
        Artisan::call('route:cache');

        return 'All caches cleared successfully!';
    });

    Route::get('/seed/role-permission', function () {

        // Chạy seeder
        Artisan::call('db:seed', [
            '--class' => 'RolePermissionSeeder',
            '--force' => true,
        ]);

        return 'RolePermissionSeeder executed successfully!';
    });

    // Players (Người chơi)
    Route::apiResource('players', UserController::class);
    Route::get('players/{id}/debts', [UserController::class, 'debts']);
    Route::post('players/{id}/roles', [UserController::class, 'assignRoles']);

    // Ratios (Mức tính)
    Route::apiResource('ratios', RatioController::class);
    Route::get('ratios/defaults', [RatioController::class, 'defaults']);

    // Menus (Menu nước)
    Route::apiResource('menus', MenuController::class);

    // Shuttles (Loại quả cầu)
    Route::get('shuttles/{id}/stock-entries', [ShuttleTypeController::class, 'stockEntries']);
    Route::post('shuttles/{id}/stock-entries', [ShuttleTypeController::class, 'storeStockEntry']);
    Route::get('shuttles/{id}/prices', [ShuttleTypeController::class, 'pricesIndex']);
    Route::post('shuttles/{id}/prices', [ShuttleTypeController::class, 'storePrice']);
    Route::delete('shuttles/{id}/prices/{priceId}', [ShuttleTypeController::class, 'destroyPrice']);
    Route::apiResource('shuttles', ShuttleTypeController::class);

    // Bills (Phiếu thu)
    Route::apiResource('bills', BillController::class);
    Route::post('bills/{id}/players/{player_id}/pay', [BillController::class, 'markPayment']);
    Route::get('bills/{id}/sub-bills', [BillController::class, 'subBills']);
    Route::post('bills/{id}/sub-bills', [BillController::class, 'createSubBill']);

    // Debts (Nợ)
    Route::apiResource('debts', DebtController::class);

    // Payment Accounts (Tài khoản nhận tiền)
    // POST route for updating with file upload (must be before apiResource to avoid route conflict)
    Route::post('payment-accounts/{id}/update', [PaymentAccountController::class, 'update']);
    Route::apiResource('payment-accounts', PaymentAccountController::class);

    // Party Bills (Chia tiền tiệc)
    Route::apiResource('party-bills', PartyBillController::class)->only(['index', 'store', 'show', 'update', 'destroy']);
    Route::post('party-bills/{id}/participants/{participantId}/pay', [PartyBillController::class, 'markPayment']);

    // Roles (Quyền)
    Route::apiResource('roles', RoleController::class);

    // Permissions (Quyền chức năng)
    Route::get('permissions', [PermissionController::class, 'index']);
    Route::get('permissions/{id}', [PermissionController::class, 'show']);

    // Tournament Brackets (Xếp bảng thi đấu)
    Route::apiResource('player-lists', PlayerListController::class);
    Route::apiResource('tournament-players', PlayerController::class);
    Route::post('tournament-players/import', [PlayerController::class, 'import']);
    Route::get('player-lists/{playerListId}/brackets', [BracketController::class, 'index']);
    Route::post('player-lists/{playerListId}/brackets/organize', [BracketController::class, 'organize']);
    Route::get('player-lists/{playerListId}/brackets/{bracketId}', [BracketController::class, 'show']);
    Route::delete('player-lists/{playerListId}/brackets/{bracketId}', [BracketController::class, 'destroy']);
    Route::delete('player-lists/{playerListId}/brackets', [BracketController::class, 'destroyAll']);
});

// Serve images with CORS headers
Route::get('images/{path}', function ($path) {
    // Decode URL-encoded path
    $decodedPath = urldecode($path);

    // Security: Only allow files from storage/app/public
    $filePath = storage_path('app/public/'.$decodedPath);
    $storagePath = storage_path('app/public');

    // Ensure the file is within the storage directory (prevent directory traversal)
    $realFilePath = realpath($filePath);
    $realStoragePath = realpath($storagePath);

    if (! $realFilePath || ! $realStoragePath || strpos($realFilePath, $realStoragePath) !== 0) {
        abort(404, 'File not found');
    }

    if (! file_exists($realFilePath) || ! is_file($realFilePath)) {
        abort(404, 'File not found');
    }

    $mimeType = mime_content_type($realFilePath) ?: 'application/octet-stream';

    return response()->file($realFilePath, [
        'Content-Type' => $mimeType,
        'Access-Control-Allow-Origin' => '*',
        'Access-Control-Allow-Methods' => 'GET, OPTIONS',
        'Access-Control-Allow-Headers' => 'Content-Type',
        'Cache-Control' => 'public, max-age=3600',
    ]);
})->where('path', '.*');
