<?php

namespace App\Services\FuelPrice;

/**
 * Đọc giá từ bảng của giavangnay.com. Cấu trúc mỗi dòng:
 *
 *   <tr>
 *     <td data-label="Sản phẩm">... <div class="brand-name">Xăng E10 RON 95-III</div> ...</td>
 *     <td class="price-cell" data-label="Giá bán lẻ">22.660</td>
 *     <td class="price-cell" data-label="Thay đổi">+550</td>
 *   </tr>
 *
 * Nguồn này không cung cấp ngày công bố.
 */
class GiaVangNayFuelSource extends AbstractFuelPriceSource
{
    public function name(): string
    {
        return 'giavangnay.com';
    }

    public function url(string $fuelKey): string
    {
        return 'https://giavangnay.com/gia-xang-e10';
    }

    public function parse(string $html, string $pattern): ?array
    {
        if (! preg_match_all('/<tr\b.*?<\/tr>/us', $html, $rows)) {
            return null;
        }

        foreach ($rows[0] as $row) {
            if (! $this->rowMatches($row, $pattern)) {
                continue;
            }

            // price-cell đầu tiên là "Giá bán lẻ"; cái thứ hai là mức thay đổi.
            if (! preg_match('/<td[^>]*class="[^"]*price-cell[^"]*"[^>]*>([^<]*)<\/td>/u', $row, $cell)) {
                return null;
            }

            $price = $this->toValidPrice($cell[1]);

            return $price === null ? null : ['price' => $price, 'date' => null];
        }

        return null;
    }

    /**
     * So khớp brand-name BẰNG CHÍNH XÁC cả chuỗi, không dùng str_contains.
     * Trang có nhiều dòng xăng tên rất giống nhau (E10 RON 95-III và
     * E10 RON 95-V), khớp chuỗi con là bắt nhầm dòng mà không báo lỗi.
     */
    private function rowMatches(string $row, string $pattern): bool
    {
        if (! preg_match('/<div[^>]*class="[^"]*brand-name[^"]*"[^>]*>(.*?)<\/div>/us', $row, $name)) {
            return false;
        }

        $text = trim(html_entity_decode(strip_tags($name[1])));

        return $text === 'Xăng '.$pattern;
    }
}
