<?php

namespace Tests\Unit\FuelPrice;

use App\Services\FuelPrice\PetrolimexFuelSource;
use PHPUnit\Framework\TestCase;

class PetrolimexFuelSourceTest extends TestCase
{
    private PetrolimexFuelSource $source;

    protected function setUp(): void
    {
        parent::setUp();
        $this->source = new PetrolimexFuelSource;
    }

    private function fixture(): string
    {
        return file_get_contents(__DIR__.'/../../Fixtures/fuel-prices/petrolimex-2026-11-19.json');
    }

    private function product(array $overrides): string
    {
        return json_encode(['Objects' => [array_merge([
            'Title' => 'Xăng E10 RON 95-III',
            'Zone1Price' => 19840,
            'Zone2Price' => 20230,
            'LastModified' => '2026-11-12T07:50:29.63Z',
        ], $overrides)]]);
    }

    public function test_ten_nguon(): void
    {
        $this->assertSame('petrolimex.com.vn', $this->source->name());
    }

    public function test_url_gui_dung_bo_loc_bang_gia_ban_le(): void
    {
        $url = $this->source->url('e10_ron95_iii');

        $this->assertStringStartsWith('https://portals.petrolimex.com.vn/~apis/portals/cms.item/search?x-request=', $url);

        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);
        $request = json_decode(base64_decode(strtr($query['x-request'], '-_', '+/')), true);

        $this->assertSame([
            ['SystemID' => ['Equals' => '6783dc1271ff449e95b74a9520964169']],
            ['RepositoryID' => ['Equals' => 'a95451e23b474fe5886bfb7cf843f53c']],
            ['RepositoryEntityID' => ['Equals' => '3801378fe1e045b1afa10de7c5776124']],
            ['Status' => ['Equals' => 'Published']],
        ], $request['FilterBy']['And']);
    }

    public function test_doc_dung_gia_vung_1_tu_du_lieu_that(): void
    {
        $result = $this->source->parse($this->fixture(), 'E10 RON 95-III');

        $this->assertSame(19840, $result['price'], 'giá vùng 1, không phải vùng 2 (20.230)');
        $this->assertSame('2026-11-12', $result['date']);
    }

    public function test_khong_bat_nham_dong_ron_95_v(): void
    {
        // Dữ liệu có cả E10 RON 95-V (21.840) lẫn E10 RON 95-III (19.840).
        $result = $this->source->parse($this->fixture(), 'E10 RON 95-V');

        $this->assertSame(21840, $result['price']);
    }

    public function test_khong_co_dong_khop_thi_tra_null(): void
    {
        $this->assertNull($this->source->parse($this->fixture(), 'E10 RON 99-Z'));
    }

    public function test_noi_dung_khong_phai_json_thi_tra_null(): void
    {
        // Trang lỗi Cloudflare, đúng thứ giavangnay.com đang trả về.
        $this->assertNull($this->source->parse('error code: 1016', 'E10 RON 95-III'));
    }

    public function test_json_khong_co_objects_thi_tra_null(): void
    {
        $this->assertNull($this->source->parse('{"Pagination":{}}', 'E10 RON 95-III'));
    }

    public function test_gia_ngoai_khoang_hop_le_thi_tra_null(): void
    {
        $this->assertNull($this->source->parse($this->product(['Zone1Price' => 999999]), 'E10 RON 95-III'));
    }

    public function test_thieu_gia_thi_tra_null(): void
    {
        $this->assertNull($this->source->parse($this->product(['Zone1Price' => null]), 'E10 RON 95-III'));
    }

    public function test_ngay_doi_sang_gio_viet_nam(): void
    {
        // 18:30 UTC ngày 12 là 01:30 sáng ngày 13 ở Việt Nam.
        $result = $this->source->parse($this->product(['LastModified' => '2026-11-12T18:30:00Z']), 'E10 RON 95-III');

        $this->assertSame('2026-11-13', $result['date']);
    }

    public function test_ngay_hong_thi_van_lay_gia_nhung_bo_ngay(): void
    {
        $result = $this->source->parse($this->product(['LastModified' => 'không phải ngày']), 'E10 RON 95-III');

        $this->assertSame(19840, $result['price']);
        $this->assertNull($result['date']);
    }
}
