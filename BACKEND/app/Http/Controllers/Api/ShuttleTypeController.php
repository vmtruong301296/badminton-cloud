<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreShuttleStockEntryRequest;
use App\Http\Requests\StoreShuttleTypePriceRequest;
use App\Http\Requests\StoreShuttleTypeRequest;
use App\Http\Requests\UpdateShuttleTypeRequest;
use App\Models\ShuttleStockEntry;
use App\Models\ShuttleType;
use App\Models\ShuttleTypePrice;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShuttleTypeController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * Query: as_of=Y-m-d — thêm price_for_bill (giá áp dụng cho bill vào ngày đó).
     * Query: with_prices=1 — kèm lịch giá (prices).
     */
    public function index(Request $request): JsonResponse
    {
        $query = ShuttleType::query()->orderBy('name');
        if ($request->boolean('with_prices')) {
            $query->with(['prices' => fn ($q) => $q->orderByDesc('effective_from')]);
        }
        $shuttleTypes = $query->get();

        if ($request->filled('as_of')) {
            ShuttleType::attachPriceForBill($shuttleTypes, (string) $request->query('as_of'));
        }

        return response()->json($shuttleTypes);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(StoreShuttleTypeRequest $request): JsonResponse
    {
        $shuttleType = ShuttleType::create($request->validated());

        return response()->json($shuttleType, 201);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id): JsonResponse
    {
        $shuttleType = ShuttleType::findOrFail($id);

        return response()->json($shuttleType);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(UpdateShuttleTypeRequest $request, string $id): JsonResponse
    {
        $shuttleType = ShuttleType::findOrFail($id);
        $validated = $request->validated();
        $shuttleType->update($validated);

        if (array_key_exists('price', $validated)) {
            ShuttleTypePrice::updateOrCreate(
                [
                    'shuttle_type_id' => $shuttleType->id,
                    'effective_from' => now()->toDateString(),
                ],
                ['price' => (int) $validated['price']]
            );
            $shuttleType->refresh();
            $shuttleType->update(['price' => $shuttleType->priceForDate(now())]);
        }

        return response()->json($shuttleType);
    }

    /**
     * Lịch giá theo ngày hiệu lực (mới nhất trước).
     */
    public function pricesIndex(string $id): JsonResponse
    {
        ShuttleType::findOrFail($id);

        $prices = ShuttleTypePrice::query()
            ->where('shuttle_type_id', $id)
            ->orderByDesc('effective_from')
            ->get();

        return response()->json($prices);
    }

    /**
     * Thêm / ghi đè mốc giá (cùng ngày hiệu lực thì cập nhật giá).
     */
    public function storePrice(StoreShuttleTypePriceRequest $request, string $id): JsonResponse
    {
        $shuttleType = ShuttleType::findOrFail($id);
        $effectiveFrom = Carbon::parse($request->input('effective_from'))->toDateString();

        ShuttleTypePrice::updateOrCreate(
            [
                'shuttle_type_id' => $shuttleType->id,
                'effective_from' => $effectiveFrom,
            ],
            ['price' => (int) $request->input('price')]
        );

        $shuttleType->refresh();
        $shuttleType->update(['price' => $shuttleType->priceForDate(now())]);

        return response()->json($shuttleType->load(['prices' => fn ($q) => $q->orderByDesc('effective_from')]), 201);
    }

    public function destroyPrice(string $id, string $priceId): JsonResponse
    {
        $shuttleType = ShuttleType::findOrFail($id);
        ShuttleTypePrice::query()
            ->where('shuttle_type_id', $shuttleType->id)
            ->where('id', $priceId)
            ->firstOrFail()
            ->delete();

        $shuttleType->refresh();
        $shuttleType->update(['price' => $shuttleType->priceForDate(now())]);

        return response()->json(['message' => 'Price tier deleted']);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id): JsonResponse
    {
        $shuttleType = ShuttleType::findOrFail($id);
        $shuttleType->delete();

        return response()->json(['message' => 'Shuttle type deleted successfully']);
    }

    /**
     * Lịch sử nhập kho theo loại cầu.
     */
    public function stockEntries(string $id): JsonResponse
    {
        ShuttleType::findOrFail($id);

        $entries = ShuttleStockEntry::where('shuttle_type_id', $id)
            ->with(['creator:id,name'])
            ->orderByDesc('entered_at')
            ->orderByDesc('created_at')
            ->get();

        return response()->json($entries);
    }

    /**
     * Nhập thêm cầu (ống + quả), cộng vào tồn kho.
     */
    public function storeStockEntry(StoreShuttleStockEntryRequest $request, string $id): JsonResponse
    {
        $shuttleType = ShuttleType::findOrFail($id);

        $tubes = (int) $request->input('tubes', 0);
        $balls = (int) $request->input('balls', 0);
        $totalBalls = $tubes * 12 + $balls;

        $enteredAt = $request->filled('entered_at')
            ? Carbon::parse($request->input('entered_at'))->startOfDay()
            : Carbon::now();

        $userId = $request->user()?->id;
        if (! $userId) {
            $userId = User::value('id');
        }

        DB::transaction(function () use ($shuttleType, $tubes, $balls, $totalBalls, $enteredAt, $userId) {
            ShuttleStockEntry::create([
                'shuttle_type_id' => $shuttleType->id,
                'tubes' => $tubes,
                'balls' => $balls,
                'total_balls' => $totalBalls,
                'entered_at' => $enteredAt->toDateString(),
                'created_by' => $userId,
            ]);

            $shuttleType->increment('stock_quantity', $totalBalls);
        });

        $shuttleType->refresh();

        return response()->json($shuttleType, 201);
    }
}
