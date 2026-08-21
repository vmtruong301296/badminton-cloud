<?php

namespace App\Services;

use App\Models\PartyBill;

/**
 * Tính lại tổng tiền và phần chia của từng người tham gia một bill tiệc.
 *
 * Điểm mấu chốt: đọc TỪ DB, không đọc request. Nhờ vậy dòng chi phí thêm do
 * thuê xe sở hữu luôn được cộng vào, dù payload của màn bill tiệc không hề
 * biết đến nó.
 */
class PartyBillRecalculator
{
    public function recalculate(PartyBill $bill): PartyBill
    {
        $bill->load(['extras', 'participants']);

        $totalExtra = (int) $bill->extras->sum('amount');
        $totalAmount = (int) $bill->base_amount + $totalExtra;

        $sumRatios = 0.0;
        foreach ($bill->participants as $participant) {
            // ratio_value cast decimal:3 nên Eloquent trả về CHUỖI.
            $sumRatios += (float) $participant->ratio_value;
        }

        $unitPrice = $sumRatios > 0 ? (int) round($totalAmount / $sumRatios) : 0;

        $bill->update([
            'total_extra' => $totalExtra,
            'total_amount' => $totalAmount,
            'unit_price' => $unitPrice,
        ]);

        foreach ($bill->participants as $participant) {
            $shareAmount = (int) round((float) $participant->ratio_value * $unitPrice);

            $participant->update([
                'share_amount' => $shareAmount,
                'total_amount' => $shareAmount
                    + (int) $participant->food_amount
                    - (int) $participant->paid_amount,
            ]);
        }

        return $bill->fresh(['extras', 'participants']);
    }

    /**
     * Bill đã thanh toán hết.
     *
     * Giữ NGUYÊN ngữ nghĩa của code cũ, kể cả việc Collection::every() trên
     * tập rỗng trả true. Không "sửa cho đẹp" trong lúc refactor.
     */
    public function isFullyPaid(PartyBill $bill): bool
    {
        $bill->loadMissing('participants');

        return $bill->participants->every(fn ($participant) => $participant->is_paid === true);
    }
}
