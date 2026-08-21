<?php

namespace App\Services\FuelPrice;

/**
 * Một nguồn giá xăng ngoài.
 *
 * parse() cố ý tách khỏi việc tải mạng: test chạy trên fixture HTML lưu sẵn,
 * không bao giờ gọi mạng thật. FuelPriceService là nơi thực hiện HTTP.
 */
interface FuelPriceSource
{
    /** Tên hiển thị của nguồn, ví dụ "baohatinh.vn". */
    public function name(): string;

    /** URL cần tải cho loại nhiên liệu này. */
    public function url(string $fuelKey): string;

    /**
     * Đọc giá từ HTML. Trả về null khi không tìm thấy hoặc giá nằm ngoài
     * khoảng hợp lệ cấu hình trong config/fuel_prices.php.
     *
     * @return array{price: int, date: ?string}|null
     */
    public function parse(string $html, string $pattern): ?array;
}
