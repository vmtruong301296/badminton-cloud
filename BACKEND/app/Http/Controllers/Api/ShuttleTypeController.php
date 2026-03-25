<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreShuttleStockEntryRequest;
use App\Http\Requests\StoreShuttleTypeRequest;
use App\Http\Requests\UpdateShuttleTypeRequest;
use App\Models\ShuttleStockEntry;
use App\Models\ShuttleType;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class ShuttleTypeController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(): JsonResponse
    {
        $shuttleTypes = ShuttleType::all();

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
        $shuttleType->update($request->validated());

        return response()->json($shuttleType);
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
