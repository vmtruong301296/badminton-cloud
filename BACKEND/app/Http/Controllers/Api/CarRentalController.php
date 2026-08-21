<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCarRentalComparisonRequest;
use App\Http\Requests\UpdateCarRentalComparisonRequest;
use App\Models\CarRentalComparison;
use App\Services\CarRentalCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CarRentalController extends Controller
{
    public function __construct(private CarRentalCalculator $calculator)
    {
    }

    public function index(): JsonResponse
    {
        $comparisons = CarRentalComparison::with(['creator', 'options'])
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($comparisons);
    }

    public function show(string $id): JsonResponse
    {
        $comparison = CarRentalComparison::with(['creator', 'options'])->findOrFail($id);

        return response()->json($comparison);
    }

    public function store(StoreCarRentalComparisonRequest $request): JsonResponse
    {
        $comparison = DB::transaction(
            fn () => $this->persist(new CarRentalComparison(), $request)
        );

        return response()->json($comparison->load(['creator', 'options']), 201);
    }

    public function update(UpdateCarRentalComparisonRequest $request, string $id): JsonResponse
    {
        $comparison = CarRentalComparison::findOrFail($id);

        $comparison = DB::transaction(
            fn () => $this->persist($comparison, $request)
        );

        return response()->json($comparison->load(['creator', 'options']));
    }

    public function destroy(string $id): JsonResponse
    {
        CarRentalComparison::findOrFail($id)->delete();

        return response()->json(['message' => 'Đã xóa so sánh thuê xe.']);
    }

    /**
     * Tính lại từ input rồi ghi đè toàn bộ options.
     *
     * Cố ý KHÔNG đọc bất kỳ trường kết quả nào client gửi lên: chỉ input được
     * dùng, mọi con số lưu xuống đều do CarRentalCalculator tính.
     */
    private function persist(CarRentalComparison $comparison, Request $request): CarRentalComparison
    {
        $days = (int) $request->input('days');
        $distanceKm = (int) $request->input('distance_km');
        $peopleCount = (int) ($request->input('people_count') ?? 0);

        $result = $this->calculator->calculate([
            'days' => $days,
            'distance_km' => $distanceKm,
            'people_count' => $peopleCount,
            'options' => $request->input('options', []),
        ]);

        $comparison->fill([
            'name' => $request->input('name') ?: null,
            'date' => $request->input('date') ?: null,
            'days' => $days,
            'distance_km' => $distanceKm,
            'people_count' => $peopleCount,
            'note' => $request->input('note') ?: null,
            'break_even_km' => $result['break_even_km'],
            'saving_amount' => $result['saving_amount'],
        ]);

        if (! $comparison->exists) {
            $comparison->created_by = $request->user()?->id;
        }

        $comparison->save();
        $comparison->options()->delete();

        foreach ($result['options'] as $option) {
            $comparison->options()->create($option);
        }

        return $comparison;
    }
}
