<?php

namespace App\Services\FuelPrice;

abstract class AbstractFuelPriceSource implements FuelPriceSource
{
    /**
     * Ngưỡng hợp lệ nhận qua constructor thay vì đọc config() toàn cục, để
     * parser thuần hoàn toàn: test chạy được không cần boot Laravel.
     * FuelPriceService là nơi truyền giá trị từ config vào.
     */
    public function __construct(
        protected int $minPrice = 10000,
        protected int $maxPrice = 60000,
    ) {
    }

    /**
     * Ép chuỗi giá kiểu "22.660" sang số nguyên, trả null nếu nằm ngoài
     * khoảng hợp lệ.
     *
     * Đây là chốt chặn parser bắt nhầm số khác trên trang: khảo sát đã gặp
     * trang chủ Petrolimex có số 20.346 là lượng khí thải CO chứ không phải giá.
     */
    protected function toValidPrice(string $raw): ?int
    {
        $digits = preg_replace('/[^\d]/', '', $raw);

        if ($digits === '' || $digits === null) {
            return null;
        }

        $price = (int) $digits;

        if ($price < $this->minPrice || $price > $this->maxPrice) {
            return null;
        }

        return $price;
    }
}
