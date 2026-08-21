<?php

namespace Tests\Unit\FuelPrice;

use App\Services\FuelPrice\BaoHaTinhFuelSource;
use PHPUnit\Framework\TestCase;

class BaoHaTinhFuelSourceTest extends TestCase
{
    private BaoHaTinhFuelSource $source;

    protected function setUp(): void
    {
        parent::setUp();
        $this->source = new BaoHaTinhFuelSource();
    }

    private function fixture(): string
    {
        return file_get_contents(__DIR__.'/../../Fixtures/fuel-prices/baohatinh-2026-08-21.html');
    }

    public function test_ten_nguon(): void
    {
        $this->assertSame('baohatinh.vn', $this->source->name());
    }

    public function test_doc_dung_gia_va_ngay_tu_trang_that(): void
    {
        $result = $this->source->parse($this->fixture(), 'E10 RON 95-III');

        $this->assertSame(22660, $result['price']);
        $this->assertSame('2026-08-21', $result['date']);
    }

    public function test_khong_tim_thay_mau_thi_tra_null(): void
    {
        $this->assertNull($this->source->parse('<html><head></head></html>', 'E10 RON 95-III'));
    }

    public function test_khong_tim_thay_dung_loai_xang_thi_tra_null(): void
    {
        $this->assertNull($this->source->parse($this->fixture(), 'E10 RON 95-V'));
    }

    public function test_gia_ngoai_khoang_hop_le_thi_tra_null(): void
    {
        $html = '<meta name="description" content="Giá Xăng E10 RON 95-III hôm nay 21/08/2026 ở mức 999.999 đồng/lít, tăng 550 đ so kỳ trước.">';

        $this->assertNull($this->source->parse($html, 'E10 RON 95-III'));
    }

    public function test_gia_qua_thap_thi_tra_null(): void
    {
        $html = '<meta name="description" content="Giá Xăng E10 RON 95-III hôm nay 21/08/2026 ở mức 999 đồng/lít, tăng 550 đ so kỳ trước.">';

        $this->assertNull($this->source->parse($html, 'E10 RON 95-III'));
    }
}
