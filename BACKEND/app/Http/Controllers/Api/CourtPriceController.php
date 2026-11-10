<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCourtPriceRequest;
use App\Models\CourtPrice;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;

/**
 * Giá sân (Master → Giá sân): lịch các mốc giá một sân / 2 giờ. Thêm / xoá mốc đều trả lại cả
 * lịch giá (mới nhất trước) để màn hiện ngay.
 */
class CourtPriceController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(CourtPrice::query()->latestFirst()->get());
    }

    /** Lên giá: trùng ngày áp dụng thì sửa giá của mốc đó. */
    public function store(StoreCourtPriceRequest $request): JsonResponse
    {
        CourtPrice::updateOrCreate(
            ['effective_from' => Carbon::parse($request->validated('effective_from'))->toDateString()],
            ['price' => (int) $request->validated('price')],
        );

        return response()->json(CourtPrice::query()->latestFirst()->get(), 201);
    }

    public function destroy(string $id): JsonResponse
    {
        $price = CourtPrice::findOrFail($id);

        if (CourtPrice::count() <= 1) {
            return response()->json(['message' => 'Phải giữ ít nhất một mốc giá sân.'], 422);
        }

        $price->delete();

        return response()->json(CourtPrice::query()->latestFirst()->get());
    }
}
