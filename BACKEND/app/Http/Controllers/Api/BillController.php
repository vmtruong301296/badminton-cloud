<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBillRequest;
use App\Http\Requests\UpdateBillRequest;
use App\Models\Bill;
use App\Models\BillPlayer;
use App\Models\BillShuttle;
use App\Models\Menu;
use App\Models\ShuttleType;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

class BillController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Bill::with(['creator', 'billShuttles.shuttleType', 'billPlayers.user', 'billPlayers.billPlayerMenus.menu', 'parentBill', 'subBills']);

        // Filter by date
        if ($request->has('date_from')) {
            $query->where('date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('date', '<=', $request->date_to);
        }

        if ($request->has('date')) {
            $query->where('date', $request->date);
        }

        // Filter by player (user_id)
        if ($request->has('player_id')) {
            $query->whereHas('billPlayers', function ($q) use ($request) {
                $q->where('user_id', $request->player_id);
            });
        }

        // Filter by parent bill (only main bills, not sub-bills)
        if ($request->has('main_only') && $request->main_only) {
            $query->whereNull('parent_bill_id');
        }

        // Filter by parent bill id
        if ($request->has('parent_bill_id')) {
            $query->where('parent_bill_id', $request->parent_bill_id);
        }

        $bills = $query->orderBy('date', 'desc')->get();

        return response()->json($bills);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreBillRequest $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            // Lấy user hiện tại, nếu không có thì mặc định dùng "Võ Trường"
            $createdBy = $request->user()?->id;
            if (! $createdBy) {
                $voTruong = User::where('name', 'LIKE', '%Võ Trường%')
                    ->orWhere('name', 'LIKE', '%Vo Truong%')
                    ->first();
                $createdBy = $voTruong?->id ?? User::value('id');
            }
            if (! $createdBy) {
                return response()->json(['error' => 'Không tìm thấy user để gán created_by'], 500);
            }

            $billDate = \Carbon\Carbon::parse($request->date)->toDateString();

            // Calculate total shuttle price (giá theo ngày bill)
            $totalShuttlePrice = 0;
            foreach ($request->shuttles as $shuttleData) {
                $shuttleType = ShuttleType::findOrFail($shuttleData['shuttle_type_id']);
                $totalShuttlePrice += $shuttleType->priceForDate($billDate) * $shuttleData['quantity'];
            }

            // Calculate total amount (court + shuttle)
            $totalAmount = $request->court_total + $totalShuttlePrice;

            // Calculate sum of ratios for all players
            $sumRatios = 0;
            $playersData = [];

            foreach ($request->players as $playerData) {
                $user = User::findOrFail($playerData['user_id']);

                // Get ratio: use provided ratio or get default from user
                $ratioValue = $playerData['ratio_value'] ?? $user->getDefaultRatio();

                $sumRatios += $ratioValue;

                // Calculate menu extra total
                $menuExtraTotal = 0;
                if (isset($playerData['menus']) && is_array($playerData['menus'])) {
                    foreach ($playerData['menus'] as $menuData) {
                        $menu = Menu::findOrFail($menuData['menu_id']);
                        $menuExtraTotal += $menu->price * $menuData['quantity'];
                    }
                }

                // Get current debt
                $debtAmount = $user->getCurrentDebtAmount();
                $debtDate = $user->debts()->where('is_resolved', false)->orderBy('debt_date', 'desc')->first()?->debt_date;

                $playersData[] = [
                    'user' => $user,
                    'ratio_value' => $ratioValue,
                    'menu_extra_total' => $menuExtraTotal,
                    'debt_amount' => $debtAmount,
                    'debt_date' => $debtDate,
                    'menus' => $playerData['menus'] ?? [],
                ];
            }

            // Calculate unit price: total_amount / sum_ratios
            $unitPrice = $sumRatios > 0 ? $totalAmount / $sumRatios : 0;

            // Create bill
            $bill = Bill::create([
                'date' => $request->date,
                'note' => $request->note,
                'court_total' => $request->court_total,
                'court_count' => null, // Không cần số sân
                'created_by' => $createdBy,
                'total_shuttle_price' => $totalShuttlePrice,
                'total_amount' => $totalAmount,
                'unit_price' => $unitPrice,
                'parent_bill_id' => $request->parent_bill_id ?? null,
            ]);

            // Create bill shuttles
            foreach ($request->shuttles as $shuttleData) {
                $shuttleType = ShuttleType::findOrFail($shuttleData['shuttle_type_id']);
                $quantity = $shuttleData['quantity'];
                $priceEach = $shuttleType->priceForDate($billDate);
                $subtotal = $priceEach * $quantity;

                BillShuttle::create([
                    'bill_id' => $bill->id,
                    'shuttle_type_id' => $shuttleType->id,
                    'quantity' => $quantity,
                    'price_each' => $priceEach,
                    'subtotal' => $subtotal,
                ]);
            }

            $this->deductShuttleStock($request->shuttles);

            // Create bill players with calculations
            foreach ($playersData as $playerData) {
                $user = $playerData['user'];
                $ratioValue = $playerData['ratio_value'];
                $menuExtraTotal = $playerData['menu_extra_total'];
                $debtAmount = $playerData['debt_amount'];
                $debtDate = $playerData['debt_date'];

                // Calculate share amount: ratio_value * unit_price (rounded)
                $shareAmount = (int) round($ratioValue * $unitPrice);

                // Calculate total amount: share_amount + menu_extra_total + debt_amount
                $playerTotalAmount = $shareAmount + $menuExtraTotal + $debtAmount;

                $billPlayer = BillPlayer::create([
                    'bill_id' => $bill->id,
                    'user_id' => $user->id,
                    'ratio_value' => $ratioValue,
                    'menu_extra_total' => $menuExtraTotal,
                    'debt_amount' => $debtAmount,
                    'debt_date' => $debtDate,
                    'share_amount' => $shareAmount,
                    'total_amount' => $playerTotalAmount,
                    'is_paid' => false,
                ]);

                // Create bill player menus
                foreach ($playerData['menus'] as $menuData) {
                    $menu = Menu::findOrFail($menuData['menu_id']);
                    $quantity = $menuData['quantity'];
                    $priceEach = $menu->price;
                    $subtotal = $priceEach * $quantity;

                    $billPlayer->billPlayerMenus()->create([
                        'menu_id' => $menu->id,
                        'quantity' => $quantity,
                        'price_each' => $priceEach,
                        'subtotal' => $subtotal,
                    ]);
                }
            }

            DB::commit();

            // Load relationships for response
            $bill->load(['creator', 'billShuttles.shuttleType', 'billPlayers.user', 'billPlayers.billPlayerMenus.menu']);

            return response()->json($bill, 201);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $bill = Bill::with([
            'creator',
            'billShuttles.shuttleType',
            'billPlayers.user',
            'billPlayers.billPlayerMenus.menu',
            'parentBill',
            'subBills.billShuttles.shuttleType',
            'subBills.billPlayers.user',
            'subBills.billPlayers.billPlayerMenus.menu',
        ])
            ->findOrFail($id);

        // Calculate debts from previous bills for each player
        foreach ($bill->billPlayers as $billPlayer) {
            $userId = $billPlayer->user_id;

            // Get all previous bills (date < current bill date) where this player hasn't paid
            $previousBills = Bill::where('date', '<', $bill->date)
                ->whereHas('billPlayers', function ($query) use ($userId) {
                    $query->where('user_id', $userId)
                        ->where('is_paid', false);
                })
                ->with(['billPlayers' => function ($query) use ($userId) {
                    $query->where('user_id', $userId);
                }, 'parentBill'])
                ->orderBy('date', 'desc')
                ->get();

            // Group bills by date and separate parent bills from sub-bills
            $billsByDate = [];
            foreach ($previousBills as $prevBill) {
                $prevBillPlayer = $prevBill->billPlayers->first();
                if ($prevBillPlayer && ! $prevBillPlayer->is_paid) {
                    $dateKey = $prevBill->date->format('Y-m-d');

                    if (! isset($billsByDate[$dateKey])) {
                        $billsByDate[$dateKey] = [
                            'parent' => null,
                            'sub_bills' => [],
                        ];
                    }

                    // If it's a sub-bill (has parent_bill_id)
                    if ($prevBill->parent_bill_id) {
                        $billsByDate[$dateKey]['sub_bills'][] = [
                            'amount' => $prevBillPlayer->total_amount,
                            'bill_id' => $prevBill->id,
                            'note' => $prevBill->note ?? '',
                        ];
                    } else {
                        // It's a parent bill
                        $billsByDate[$dateKey]['parent'] = [
                            'amount' => $prevBillPlayer->total_amount,
                            'bill_id' => $prevBill->id,
                        ];
                    }
                }
            }

            // Calculate total debt and format debt details
            $totalDebt = 0;
            $debtDetails = [];

            // Helper function to round to nearest thousand (consistent with frontend)
            $roundToNearestThousand = function ($amount) {
                return round($amount / 1000) * 1000;
            };

            // Sort dates in descending order (newest first)
            krsort($billsByDate);

            foreach ($billsByDate as $date => $billsGroup) {
                $dateDebt = 0;
                $detail = [
                    'date' => $date,
                    'parent_amount' => null,
                    'sub_bills' => [],
                ];

                // Add parent bill debt (rounded to nearest thousand)
                if ($billsGroup['parent']) {
                    $roundedParentAmount = $roundToNearestThousand($billsGroup['parent']['amount']);
                    $dateDebt += $roundedParentAmount;
                    $totalDebt += $roundedParentAmount;
                    $detail['parent_amount'] = $roundedParentAmount;
                    $detail['parent_bill_id'] = $billsGroup['parent']['bill_id'];
                }

                // Add sub-bills debts (rounded to nearest thousand)
                foreach ($billsGroup['sub_bills'] as $subBill) {
                    $roundedSubBillAmount = $roundToNearestThousand($subBill['amount']);
                    $dateDebt += $roundedSubBillAmount;
                    $totalDebt += $roundedSubBillAmount;
                    $detail['sub_bills'][] = [
                        'note' => $subBill['note'],
                        'amount' => $roundedSubBillAmount,
                        'bill_id' => $subBill['bill_id'],
                    ];
                }

                // Only add to details if there's debt for this date
                if ($dateDebt > 0) {
                    $debtDetails[] = $detail;
                }
            }

            // Update billPlayer with calculated debt
            $billPlayer->debt_amount = $totalDebt;
            $billPlayer->debt_details = $debtDetails;
            if (count($debtDetails) > 0) {
                $billPlayer->debt_date = $debtDetails[0]['date']; // Latest debt date
            }
        }

        return response()->json($bill);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateBillRequest $request, string $id): JsonResponse
    {
        try {
            DB::beginTransaction();

            /** @var Bill $bill */
            $bill = Bill::with(['billShuttles', 'billPlayers.billPlayerMenus'])->findOrFail($id);

            $billDate = \Carbon\Carbon::parse($request->date)->toDateString();

            // Calculate total shuttle price
            $totalShuttlePrice = 0;
            foreach ($request->shuttles as $shuttleData) {
                $shuttleType = ShuttleType::findOrFail($shuttleData['shuttle_type_id']);
                $totalShuttlePrice += $shuttleType->priceForDate($billDate) * $shuttleData['quantity'];
            }

            // Calculate total amount (court + shuttle)
            $totalAmount = $request->court_total + $totalShuttlePrice;

            // Calculate sum of ratios for all players
            $sumRatios = 0;
            $playersData = [];

            foreach ($request->players as $playerData) {
                $user = User::findOrFail($playerData['user_id']);

                // Get ratio: use provided ratio or get default from user
                $ratioValue = $playerData['ratio_value'] ?? $user->getDefaultRatio();

                $sumRatios += $ratioValue;

                // Calculate menu extra total
                $menuExtraTotal = 0;
                if (isset($playerData['menus']) && is_array($playerData['menus'])) {
                    foreach ($playerData['menus'] as $menuData) {
                        $menu = Menu::findOrFail($menuData['menu_id']);
                        $menuExtraTotal += $menu->price * $menuData['quantity'];
                    }
                }

                // Get current debt
                $debtAmount = $user->getCurrentDebtAmount();
                $debtDate = $user->debts()->where('is_resolved', false)->orderBy('debt_date', 'desc')->first()?->debt_date;

                $playersData[] = [
                    'user' => $user,
                    'ratio_value' => $ratioValue,
                    'menu_extra_total' => $menuExtraTotal,
                    'debt_amount' => $debtAmount,
                    'debt_date' => $debtDate,
                    'menus' => $playerData['menus'] ?? [],
                ];
            }

            // Calculate unit price: total_amount / sum_ratios
            $unitPrice = $sumRatios > 0 ? $totalAmount / $sumRatios : 0;

            // Update bill (keep created_by as-is)
            $bill->update([
                'date' => $request->date,
                'note' => $request->note,
                'court_total' => $request->court_total,
                'court_count' => null, // Không cần số sân
                'total_shuttle_price' => $totalShuttlePrice,
                'total_amount' => $totalAmount,
                'unit_price' => $unitPrice,
                'parent_bill_id' => $request->parent_bill_id ?? $bill->parent_bill_id,
            ]);

            // Remove existing related records
            foreach ($bill->billPlayers as $billPlayer) {
                $billPlayer->billPlayerMenus()->delete();
            }
            $this->restoreShuttleStockFromBill($bill);

            $bill->billPlayers()->delete();
            $bill->billShuttles()->delete();

            // Re-create bill shuttles
            foreach ($request->shuttles as $shuttleData) {
                $shuttleType = ShuttleType::findOrFail($shuttleData['shuttle_type_id']);
                $quantity = $shuttleData['quantity'];
                $priceEach = $shuttleType->priceForDate($billDate);
                $subtotal = $priceEach * $quantity;

                BillShuttle::create([
                    'bill_id' => $bill->id,
                    'shuttle_type_id' => $shuttleType->id,
                    'quantity' => $quantity,
                    'price_each' => $priceEach,
                    'subtotal' => $subtotal,
                ]);
            }

            $this->deductShuttleStock($request->shuttles);

            // Re-create bill players with calculations
            foreach ($playersData as $playerData) {
                $user = $playerData['user'];
                $ratioValue = $playerData['ratio_value'];
                $menuExtraTotal = $playerData['menu_extra_total'];
                $debtAmount = $playerData['debt_amount'];
                $debtDate = $playerData['debt_date'];

                // Calculate share amount: ratio_value * unit_price (rounded)
                $shareAmount = (int) round($ratioValue * $unitPrice);

                // Calculate total amount: share_amount + menu_extra_total + debt_amount
                $playerTotalAmount = $shareAmount + $menuExtraTotal + $debtAmount;

                $billPlayer = BillPlayer::create([
                    'bill_id' => $bill->id,
                    'user_id' => $user->id,
                    'ratio_value' => $ratioValue,
                    'menu_extra_total' => $menuExtraTotal,
                    'debt_amount' => $debtAmount,
                    'debt_date' => $debtDate,
                    'share_amount' => $shareAmount,
                    'total_amount' => $playerTotalAmount,
                    'is_paid' => false,
                ]);

                // Create bill player menus
                foreach ($playerData['menus'] as $menuData) {
                    $menu = Menu::findOrFail($menuData['menu_id']);
                    $quantity = $menuData['quantity'];
                    $priceEach = $menu->price;
                    $subtotal = $priceEach * $quantity;

                    $billPlayer->billPlayerMenus()->create([
                        'menu_id' => $menu->id,
                        'quantity' => $quantity,
                        'price_each' => $priceEach,
                        'subtotal' => $subtotal,
                    ]);
                }
            }

            DB::commit();

            // Load relationships for response
            $bill->load(['creator', 'billShuttles.shuttleType', 'billPlayers.user', 'billPlayers.billPlayerMenus.menu']);

            return response()->json($bill);
        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    /**
     * Mark payment for a player in a bill.
     */
    public function markPayment(Request $request, string $id, string $player_id): JsonResponse
    {
        $request->validate([
            'amount' => 'nullable|integer|min:0',
            'method' => 'nullable|string|max:255',
            'is_paid' => 'nullable|boolean',
        ]);

        $bill = Bill::findOrFail($id);
        $billPlayer = BillPlayer::where('bill_id', $bill->id)
            ->where('user_id', $player_id)
            ->firstOrFail();

        // Nếu có is_paid trong request, dùng giá trị đó
        // Nếu không, dựa vào amount để quyết định
        if ($request->has('is_paid')) {
            $isPaid = (bool) $request->is_paid;
        } else {
            // Logic cũ: nếu có amount và amount >= total_amount thì mark as paid
            $isPaid = $request->has('amount')
                ? ($request->amount >= $billPlayer->total_amount)
                : true;
        }

        $billPlayer->update([
            'is_paid' => $isPaid,
            'paid_at' => $isPaid ? now() : null,
        ]);

        $bill->load(['creator', 'billShuttles.shuttleType', 'billPlayers.user', 'billPlayers.billPlayerMenus.menu']);

        return response()->json([
            'message' => 'Payment marked successfully',
            'bill' => $bill,
            'bill_player' => $billPlayer,
        ]);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $bill = Bill::with('billShuttles')->findOrFail($id);

        DB::transaction(function () use ($bill) {
            $this->restoreShuttleStockFromBill($bill);
            $bill->delete();
        });

        return response()->json(['message' => 'Bill deleted successfully']);
    }

    /**
     * Send exported bill PNG to a fixed Telegram chat configured via env.
     * Frontend POSTs `file` (PNG of the bill) + optional `caption`.
     */
    public function sendTelegram(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimetypes:image/png,image/jpeg|max:10240',
        ]);

        $token = config('services.telegram.bot_token');
        $chatId = config('services.telegram.chat_id');
        if (! $token || ! $chatId) {
            return response()->json([
                'error' => 'Telegram chưa được cấu hình (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).',
            ], 500);
        }

        $bill = Bill::findOrFail($id);
        $date = $bill->date ? Carbon::parse($bill->date)->format('d/m/Y') : '';
        $caption = trim(($request->input('caption') ?: '')."\nBill #{$bill->id}".($date ? " - {$date}" : ''));

        $file = $request->file('file');
        $filename = 'bill_'.$bill->id.'.png';

        try {
            $response = Http::timeout(30)
                ->attach('document', file_get_contents($file->getRealPath()), $filename)
                ->post("https://api.telegram.org/bot{$token}/sendDocument", [
                    'chat_id' => $chatId,
                    'caption' => $caption,
                ]);

            if (! $response->successful()) {
                return response()->json([
                    'error' => 'Telegram API trả về lỗi',
                    'detail' => $response->json() ?: $response->body(),
                ], 502);
            }

            return response()->json(['ok' => true]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Không thể gửi Telegram: '.$e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get sub-bills of a parent bill
     */
    public function subBills(string $id): JsonResponse
    {
        $parentBill = Bill::findOrFail($id);
        $subBills = Bill::with([
            'creator',
            'billShuttles.shuttleType',
            'billPlayers.user',
            'billPlayers.billPlayerMenus.menu',
        ])
            ->where('parent_bill_id', $id)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($subBills);
    }

    /**
     * Create a sub-bill from a parent bill
     */
    public function createSubBill(StoreBillRequest $request, string $id): JsonResponse
    {
        $parentBill = Bill::findOrFail($id);

        // Set parent_bill_id in request
        $request->merge(['parent_bill_id' => $id]);

        // Call store method with modified request
        return $this->store($request);
    }

    /**
     * Trừ tồn kho (quả) theo từng dòng cầu trên bill.
     *
     * @param  array<int, array{shuttle_type_id: int, quantity: int}>  $shuttlesData
     */
    private function deductShuttleStock(array $shuttlesData): void
    {
        foreach ($shuttlesData as $shuttleData) {
            $typeId = (int) $shuttleData['shuttle_type_id'];
            $qty = (int) $shuttleData['quantity'];
            ShuttleType::where('id', $typeId)->decrement('stock_quantity', $qty);
        }
    }

    /**
     * Hoàn lại tồn kho khi sửa/xóa bill (theo các dòng bill_shuttles hiện có).
     */
    private function restoreShuttleStockFromBill(Bill $bill): void
    {
        foreach ($bill->billShuttles as $bs) {
            ShuttleType::where('id', $bs->shuttle_type_id)->increment('stock_quantity', $bs->quantity);
        }
    }
}
