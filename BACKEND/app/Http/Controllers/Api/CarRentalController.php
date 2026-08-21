<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\PartyBillLockedException;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCarRentalComparisonRequest;
use App\Http\Requests\UpdateCarRentalComparisonRequest;
use App\Models\CarRentalComparison;
use App\Services\CarRentalCalculator;
use App\Services\CarRentalPartyBillLink;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CarRentalController extends Controller
{
    public function __construct(
        private CarRentalCalculator $calculator,
        private CarRentalPartyBillLink $link,
    ) {
    }

    public function index(): JsonResponse
    {
        $comparisons = CarRentalComparison::with(['creator', 'options', 'sharedCosts', 'partyBill'])
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($comparisons);
    }

    public function show(string $id): JsonResponse
    {
        $comparison = CarRentalComparison::with(['creator', 'options', 'sharedCosts', 'partyBill'])->findOrFail($id);

        return response()->json($comparison);
    }

    public function store(StoreCarRentalComparisonRequest $request): JsonResponse
    {
        $comparison = $this->persistWithLink(new CarRentalComparison(), $request, null);

        return response()->json($comparison->load(['creator', 'options', 'sharedCosts', 'partyBill']), 201);
    }

    public function update(UpdateCarRentalComparisonRequest $request, string $id): JsonResponse
    {
        $comparison = CarRentalComparison::findOrFail($id);
        $previousBillId = $comparison->party_bill_id;

        $comparison = $this->persistWithLink($comparison, $request, $previousBillId);

        return response()->json($comparison->load(['creator', 'options', 'sharedCosts', 'partyBill']));
    }

    public function destroy(string $id): JsonResponse
    {
        $comparison = CarRentalComparison::with('options')->findOrFail($id);

        try {
            DB::transaction(function () use ($comparison) {
                // Gỡ TRƯỚC khi xóa: cascadeOnDelete không kích hoạt việc tính
                // lại tiền bill tiệc.
                $this->link->detach($comparison);
                $comparison->delete();
            });
        } catch (PartyBillLockedException $e) {
            throw ValidationException::withMessages(['party_bill_id' => $e->getMessage()]);
        }

        return response()->json(['message' => 'Đã xóa so sánh thuê xe.']);
    }

    /**
     * Lưu lần thuê xe rồi đồng bộ bill tiệc TRONG CÙNG transaction.
     *
     * Bill tiệc bị khóa thì rollback sạch: lần thuê xe cũng không được lưu,
     * để hai bên không bao giờ lệch nhau.
     */
    private function persistWithLink(
        CarRentalComparison $comparison,
        Request $request,
        ?int $previousBillId
    ): CarRentalComparison {
        try {
            return DB::transaction(function () use ($comparison, $request, $previousBillId) {
                $saved = $this->persist($comparison, $request);
                $this->link->sync($saved, $previousBillId);

                return $saved->fresh();
            });
        } catch (PartyBillLockedException $e) {
            throw ValidationException::withMessages([
                'party_bill_id' => $e->getMessage(),
            ]);
        }
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
            'shared_costs' => $request->input('shared_costs', []),
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
            'total_shared_cost' => $result['total_shared_cost'],
            // Ép kiểu int TRƯỚC khi rơi về null: CarRentalPartyBillLink::sync()
            // so sánh strict (!==) giá trị này với $previousBillId (int|null)
            // lấy từ DB — một chuỗi "5" lọt qua sẽ bị hiểu nhầm là "đổi sang
            // bill khác" dù cùng một bill, gây xóa/tạo lại dòng extra thừa.
            'party_bill_id' => (int) $request->input('party_bill_id') ?: null,
            'selected_sort_order' => $request->input('selected_sort_order'),
        ]);

        if (! $comparison->exists) {
            $comparison->created_by = $request->user()?->id;
        }

        $comparison->save();

        $comparison->options()->delete();
        foreach ($result['options'] as $option) {
            $comparison->options()->create($option);
        }

        $comparison->sharedCosts()->delete();
        foreach ($result['shared_costs'] as $sharedCost) {
            $comparison->sharedCosts()->create($sharedCost);
        }

        return $comparison;
    }
}
