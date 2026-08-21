<?php

namespace App\Services\FuelPrice;

/**
 * Đọc giá từ thẻ meta description của baohatinh.vn, dạng:
 *
 *   Giá Xăng E10 RON 95-III hôm nay 21/08/2026 ở mức 22.660 đồng/lít, tăng 550 đ...
 *
 * Nguồn này có kèm ngày công bố nên dùng để đối chiếu độ tươi của dữ liệu.
 */
class BaoHaTinhFuelSource extends AbstractFuelPriceSource
{
    public function name(): string
    {
        return 'baohatinh.vn';
    }

    public function url(string $fuelKey): string
    {
        return 'https://baohatinh.vn/cong-cu/gia-xang-dau/ron95';
    }

    public function parse(string $html, string $pattern): ?array
    {
        $regex = '/Giá\s+Xăng\s+'.preg_quote($pattern, '/')
            .'\s+hôm nay\s+(\d{2})\/(\d{2})\/(\d{4})\s+ở mức\s+([\d.,]+)\s+đồng\/lít/u';

        if (! preg_match($regex, $html, $matches)) {
            return null;
        }

        $price = $this->toValidPrice($matches[4]);

        if ($price === null) {
            return null;
        }

        return [
            'price' => $price,
            'date' => sprintf('%s-%s-%s', $matches[3], $matches[2], $matches[1]),
        ];
    }
}
