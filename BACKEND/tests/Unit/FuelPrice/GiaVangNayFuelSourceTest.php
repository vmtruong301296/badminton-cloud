<?php

namespace Tests\Unit\FuelPrice;

use App\Services\FuelPrice\GiaVangNayFuelSource;
use PHPUnit\Framework\TestCase;

class GiaVangNayFuelSourceTest extends TestCase
{
    private GiaVangNayFuelSource $source;

    protected function setUp(): void
    {
        parent::setUp();
        $this->source = new GiaVangNayFuelSource();
    }

    private function fixture(): string
    {
        return file_get_contents(__DIR__.'/../../Fixtures/fuel-prices/giavangnay-2026-08-21.html');
    }

    public function test_ten_nguon(): void
    {
        $this->assertSame('giavangnay.com', $this->source->name());
    }

    public function test_doc_dung_gia_tu_trang_that(): void
    {
        $result = $this->source->parse($this->fixture(), 'E10 RON 95-III');

        $this->assertSame(22660, $result['price']);
        $this->assertNull($result['date'], 'nguồn này không cung cấp ngày');
    }

    public function test_khong_bat_nham_dong_ron_95_v(): void
    {
        // Trang có cả E10 RON 95-V (24.060) lẫn E10 RON 95-III (22.660).
        $result = $this->source->parse($this->fixture(), 'E10 RON 95-V');

        $this->assertSame(24060, $result['price']);
    }

    public function test_khong_co_dong_khop_thi_tra_null(): void
    {
        $this->assertNull($this->source->parse($this->fixture(), 'E10 RON 99-Z'));
    }

    public function test_html_khong_co_bang_thi_tra_null(): void
    {
        $this->assertNull($this->source->parse('<html><body>không có gì</body></html>', 'E10 RON 95-III'));
    }

    public function test_gia_ngoai_khoang_hop_le_thi_tra_null(): void
    {
        $html = '<table><tr><td><div class="brand-name">Xăng E10 RON 95-III</div></td>'
            .'<td class="price-cell">999.999</td></tr></table>';

        $this->assertNull($this->source->parse($html, 'E10 RON 95-III'));
    }
}
