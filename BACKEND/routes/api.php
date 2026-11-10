<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BillController;
use App\Http\Controllers\Api\BracketController;
use App\Http\Controllers\Api\CarRentalController;
use App\Http\Controllers\Api\CourtPriceController;
use App\Http\Controllers\Api\DebtController;
use App\Http\Controllers\Api\FuelPriceController;
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
use App\Http\Middleware\RequirePermission;
use Illuminate\Support\Facades\Route;

// Authentication (Public routes)
Route::post('login', [AuthController::class, 'login']);
Route::post('logout', [AuthController::class, 'logout'])->middleware('auth');
Route::get('me', [AuthController::class, 'me'])->middleware('auth');

// Protected routes - require authentication + a permission per route.
// Quyền từng route khớp với màn frontend đang gọi nó; lý do từng dòng:
// docs/superpowers/specs/2026-11-05-kiem-quyen-api.md (test: tests/Feature/ApiPermissionTest.php).
Route::middleware('auth')->group(function () {
    // Màn Master hiện đủ 4 tab cho ai có một trong các quyền xem này (App.jsx MasterRouteGuard).
    $masterTabs = ['ratios.view', 'menus.view', 'shuttles.view', 'payment_accounts.view'];
    // Màn tạo / sửa bill cầu và bill tiệc: tải + thêm nhanh người chơi, tải mức tính mặc định.
    $billForms = ['bills.create', 'bills.update'];
    $partyBillForms = ['party_bills.create', 'party_bills.update'];

    // Players (Người chơi)
    Route::apiResource('players', UserController::class)
        ->middlewareFor('index', RequirePermission::any('users.view', ...$billForms, ...$partyBillForms))
        ->middlewareFor('store', RequirePermission::any('users.create', 'users.view', ...$billForms, ...$partyBillForms))
        ->middlewareFor('show', RequirePermission::any('users.view'))
        ->middlewareFor('update', RequirePermission::any('users.update'))
        ->middlewareFor('destroy', RequirePermission::any('users.delete'));
    Route::get('players/{id}/debts', [UserController::class, 'debts'])
        ->middleware(RequirePermission::any('users.view'));
    Route::post('players/{id}/roles', [UserController::class, 'assignRoles'])
        ->middleware(RequirePermission::any('roles.assign'));

    // Ratios (Mức tính)
    Route::apiResource('ratios', RatioController::class)
        ->middlewareFor('index', RequirePermission::any(...$masterTabs, ...$billForms, ...$partyBillForms))
        ->middlewareFor('store', RequirePermission::any('ratios.create'))
        ->middlewareFor('show', RequirePermission::any('ratios.view'))
        ->middlewareFor('update', RequirePermission::any('ratios.update'))
        ->middlewareFor('destroy', RequirePermission::any('ratios.delete'));
    Route::get('ratios/defaults', [RatioController::class, 'defaults'])
        ->middleware(RequirePermission::any(...$masterTabs, ...$billForms, ...$partyBillForms));

    // Menus (Menu nước)
    Route::apiResource('menus', MenuController::class)
        ->middlewareFor('index', RequirePermission::any(...$masterTabs, ...$billForms))
        ->middlewareFor('store', RequirePermission::any('menus.create', ...$billForms))
        ->middlewareFor('show', RequirePermission::any('menus.view'))
        ->middlewareFor('update', RequirePermission::any('menus.update'))
        ->middlewareFor('destroy', RequirePermission::any('menus.delete'));

    // Shuttles (Loại quả cầu)
    Route::get('shuttles/{id}/stock-entries', [ShuttleTypeController::class, 'stockEntries'])
        ->middleware(RequirePermission::any('shuttles.view', 'shuttles.update'));
    Route::post('shuttles/{id}/stock-entries', [ShuttleTypeController::class, 'storeStockEntry'])
        ->middleware(RequirePermission::any('shuttles.update'));
    Route::get('shuttles/{id}/prices', [ShuttleTypeController::class, 'pricesIndex'])
        ->middleware(RequirePermission::any('shuttles.view', 'shuttles.update'));
    Route::post('shuttles/{id}/prices', [ShuttleTypeController::class, 'storePrice'])
        ->middleware(RequirePermission::any('shuttles.update'));
    Route::delete('shuttles/{id}/prices/{priceId}', [ShuttleTypeController::class, 'destroyPrice'])
        ->middleware(RequirePermission::any('shuttles.update'));
    Route::apiResource('shuttles', ShuttleTypeController::class)
        ->middlewareFor('index', RequirePermission::any('bills.view', ...$masterTabs, ...$billForms))
        ->middlewareFor('store', RequirePermission::any('shuttles.create'))
        ->middlewareFor('show', RequirePermission::any('shuttles.view'))
        ->middlewareFor('update', RequirePermission::any('shuttles.update'))
        ->middlewareFor('destroy', RequirePermission::any('shuttles.delete'));

    // Giá sân (tab Master): form bill con đọc để tính tiền sân theo giờ; lên giá dùng quyền sửa loại cầu
    Route::get('court-prices', [CourtPriceController::class, 'index'])
        ->middleware(RequirePermission::any(...$masterTabs, ...$billForms));
    Route::post('court-prices', [CourtPriceController::class, 'store'])
        ->middleware(RequirePermission::any('shuttles.update'));
    Route::delete('court-prices/{id}', [CourtPriceController::class, 'destroy'])
        ->middleware(RequirePermission::any('shuttles.update'));

    // Bills (Phiếu thu)
    Route::apiResource('bills', BillController::class)
        ->middlewareFor('index', RequirePermission::any('bills.view'))
        ->middlewareFor('store', RequirePermission::any('bills.create'))
        ->middlewareFor('show', RequirePermission::any('bills.view', ...$billForms))
        ->middlewareFor('update', RequirePermission::any('bills.update'))
        ->middlewareFor('destroy', RequirePermission::any('bills.delete'));
    Route::post('bills/{id}/players/{player_id}/pay', [BillController::class, 'markPayment'])
        ->middleware(RequirePermission::any('bills.mark_payment'));
    Route::get('bills/{id}/sub-bills', [BillController::class, 'subBills'])
        ->middleware(RequirePermission::any('bills.view'));
    Route::post('bills/{id}/sub-bills', [BillController::class, 'createSubBill'])
        ->middleware(RequirePermission::any('bills.create'));
    Route::post('bills/{id}/send-telegram', [BillController::class, 'sendTelegram'])
        ->middleware(RequirePermission::any('bills.view'));

    // Debts (Nợ) — frontend chưa gọi, không có quyền riêng: theo quyền người chơi.
    Route::apiResource('debts', DebtController::class)
        ->middlewareFor(['index', 'show'], RequirePermission::any('users.view'))
        ->middlewareFor(['store', 'update', 'destroy'], RequirePermission::any('users.update'));

    // Payment Accounts (Tài khoản nhận tiền)
    // POST route for updating with file upload (must be before apiResource to avoid route conflict)
    Route::post('payment-accounts/{id}/update', [PaymentAccountController::class, 'update'])
        ->middleware(RequirePermission::any('payment_accounts.update'));
    Route::apiResource('payment-accounts', PaymentAccountController::class)
        ->middlewareFor('index', RequirePermission::any('bills.view', 'party_bills.view', ...$masterTabs))
        ->middlewareFor('store', RequirePermission::any('payment_accounts.create'))
        ->middlewareFor('show', RequirePermission::any('payment_accounts.view'))
        ->middlewareFor('update', RequirePermission::any('payment_accounts.update'))
        ->middlewareFor('destroy', RequirePermission::any('payment_accounts.delete'));

    // Party Bills (Chia tiền tiệc)
    Route::apiResource('party-bills', PartyBillController::class)->only(['index', 'store', 'show', 'update', 'destroy'])
        ->middlewareFor('index', RequirePermission::any('party_bills.view', 'car_rentals.view'))
        ->middlewareFor('store', RequirePermission::any('party_bills.create'))
        ->middlewareFor('show', RequirePermission::any('party_bills.view', 'party_bills.update'))
        ->middlewareFor('update', RequirePermission::any('party_bills.update'))
        ->middlewareFor('destroy', RequirePermission::any('party_bills.delete'));

    // Car Rentals (So sánh chi phí thuê xe)
    Route::apiResource('car-rentals', CarRentalController::class)
        ->only(['index', 'store', 'show', 'update', 'destroy'])
        ->middlewareFor(['index', 'show'], RequirePermission::any('car_rentals.view'))
        ->middlewareFor('store', RequirePermission::any('car_rentals.create'))
        ->middlewareFor('update', RequirePermission::any('car_rentals.update'))
        ->middlewareFor('destroy', RequirePermission::any('car_rentals.delete'));

    // Fuel Prices (Giá xăng thị trường)
    Route::get('fuel-prices', [FuelPriceController::class, 'index'])
        ->middleware(RequirePermission::any('car_rentals.view'));
    Route::post('fuel-prices/{fuelKey}/refresh', [FuelPriceController::class, 'refresh'])
        ->middleware(RequirePermission::any('car_rentals.update'));
    Route::put('fuel-prices/{fuelKey}', [FuelPriceController::class, 'update'])
        ->middleware(RequirePermission::any('car_rentals.update'));
    // Bill tiệc không có quyền riêng cho đánh dấu thanh toán: frontend dùng party_bills.update.
    Route::post('party-bills/{id}/participants/{participantId}/pay', [PartyBillController::class, 'markPayment'])
        ->middleware(RequirePermission::any('party_bills.update'));
    Route::post('party-bills/{id}/send-telegram', [PartyBillController::class, 'sendTelegram'])
        ->middleware(RequirePermission::any('party_bills.view'));

    // Roles (Quyền)
    Route::apiResource('roles', RoleController::class)
        ->middlewareFor('index', RequirePermission::any('roles.view', 'roles.assign'))
        ->middlewareFor('store', RequirePermission::any('roles.create'))
        ->middlewareFor('show', RequirePermission::any('roles.view'))
        ->middlewareFor('update', RequirePermission::any('roles.update'))
        ->middlewareFor('destroy', RequirePermission::any('roles.delete'));

    // Permissions (Quyền chức năng)
    Route::get('permissions', [PermissionController::class, 'index'])
        ->middleware(RequirePermission::any('roles.view'));
    Route::get('permissions/{id}', [PermissionController::class, 'show'])
        ->middleware(RequirePermission::any('roles.view'));

    // Tournament Brackets (Xếp bảng thi đấu) — dữ liệu theo từng người tạo danh sách.
    // Màn xếp bảng (tournament_brackets.view) tự tạo danh sách mặc định khi chưa có, và hiện
    // Thêm VĐV / Import / Xóa VĐV cho mọi người vào được màn.
    Route::apiResource('player-lists', PlayerListController::class)
        ->middlewareFor(['index', 'show'], RequirePermission::any('tournament_brackets.view'))
        ->middlewareFor('store', RequirePermission::any('tournament_brackets.view', 'tournament_brackets.create_list'))
        ->middlewareFor('update', RequirePermission::any('tournament_brackets.create_list'))
        ->middlewareFor('destroy', RequirePermission::any('tournament_brackets.delete'));
    Route::apiResource('tournament-players', PlayerController::class)
        ->middlewareFor(['index', 'show'], RequirePermission::any('tournament_brackets.view'))
        ->middlewareFor(['store', 'destroy'], RequirePermission::any('tournament_brackets.view', 'tournament_brackets.create_list'))
        ->middlewareFor('update', RequirePermission::any('tournament_brackets.create_list'));
    Route::post('tournament-players/import', [PlayerController::class, 'import'])
        ->middleware(RequirePermission::any('tournament_brackets.view', 'tournament_brackets.create_list'));
    Route::get('player-lists/{playerListId}/brackets', [BracketController::class, 'index'])
        ->middleware(RequirePermission::any('tournament_brackets.view'));
    Route::post('player-lists/{playerListId}/brackets/organize', [BracketController::class, 'organize'])
        ->middleware(RequirePermission::any('tournament_brackets.organize'));
    Route::get('player-lists/{playerListId}/brackets/{bracketId}', [BracketController::class, 'show'])
        ->middleware(RequirePermission::any('tournament_brackets.view'));
    Route::delete('player-lists/{playerListId}/brackets/{bracketId}', [BracketController::class, 'destroy'])
        ->middleware(RequirePermission::any('tournament_brackets.delete'));
    Route::delete('player-lists/{playerListId}/brackets', [BracketController::class, 'destroyAll'])
        ->middleware(RequirePermission::any('tournament_brackets.delete'));
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
