<?php

namespace App\Services;

use App\Exceptions\PartyBillLockedException;
use App\Models\CarRentalComparison;
use App\Models\PartyBill;
use App\Models\PartyBillExtra;

/**
 * Giữ dòng chi phí thêm bên bill tiệc khớp với lần thuê xe đã gắn.
 *
 * Mọi nhánh chạm vào tiền đều đi qua lockGuard(): một bill đã thanh toán hết
 * thì không gắn cũng không gỡ được, vì cả hai đều làm đổi tiền của mọi người.
 *
 * sync() kiểm tra khóa của CẢ HAI bill (cũ và mới, khi chuyển bill) trước khi
 * đụng vào bất kỳ dòng dữ liệu nào. Nhờ vậy nếu bill đích bị khóa, bill cũ sẽ
 * không hề bị sửa dở dang rồi mới báo lỗi — thao tác hoặc trọn vẹn, hoặc
 * không làm gì cả.
 */
class CarRentalPartyBillLink
{
    public function __construct(private PartyBillRecalculator $recalculator)
    {
    }

    public function sync(CarRentalComparison $comparison, ?int $previousBillId): void
    {
        $currentBillId = $comparison->party_bill_id;
        $isMovingBill = $previousBillId !== null && $previousBillId !== $currentBillId;

        $previousBill = $isMovingBill ? $this->lockGuard($previousBillId) : null;
        $currentBill = $currentBillId !== null ? $this->lockGuard($currentBillId) : null;

        if ($previousBill !== null) {
            $this->removeExtra($previousBill, $comparison->id);
        }

        if ($currentBill !== null) {
            PartyBillExtra::updateOrCreate(
                [
                    'party_bill_id' => $currentBill->id,
                    'car_rental_comparison_id' => $comparison->id,
                ],
                [
                    'name' => $this->extraName($comparison),
                    'amount' => $this->selectedAmount($comparison),
                ]
            );

            $this->recalculator->recalculate($currentBill);
        }
    }

    public function detach(CarRentalComparison $comparison): void
    {
        if ($comparison->party_bill_id === null) {
            return;
        }

        $bill = $this->lockGuard($comparison->party_bill_id);

        $this->removeExtra($bill, $comparison->id);
    }

    private function removeExtra(PartyBill $bill, int $comparisonId): void
    {
        PartyBillExtra::where('party_bill_id', $bill->id)
            ->where('car_rental_comparison_id', $comparisonId)
            ->delete();

        $this->recalculator->recalculate($bill);
    }

    /** @throws PartyBillLockedException */
    private function lockGuard(int $billId): PartyBill
    {
        $bill = PartyBill::with('participants')->findOrFail($billId);

        if ($this->recalculator->isFullyPaid($bill)) {
            throw new PartyBillLockedException($bill->name ?: "#{$bill->id}");
        }

        return $bill;
    }

    private function extraName(CarRentalComparison $comparison): string
    {
        $name = trim((string) $comparison->name);

        return $name !== '' ? $name : "Chuyến xe #{$comparison->id}";
    }

    /**
     * Tiền của phương án thực tế thuê.
     *
     * Không tìm được (chưa chọn, hoặc trỏ vào phương án đã bị xóa trong lần
     * sửa sau) thì lui về phương án rẻ nhất, đồng thời xóa con trỏ chết để dữ
     * liệu không giữ một tham chiếu không còn tồn tại.
     */
    private function selectedAmount(CarRentalComparison $comparison): int
    {
        $comparison->loadMissing('options');

        $selected = $comparison->selected_sort_order === null
            ? null
            : $comparison->options->firstWhere('sort_order', $comparison->selected_sort_order);

        if ($selected === null) {
            if ($comparison->selected_sort_order !== null) {
                $comparison->forceFill(['selected_sort_order' => null])->save();
            }

            $selected = $comparison->options->firstWhere('is_cheapest', true);
        }

        return (int) ($selected?->trip_total_cost ?? 0);
    }
}
