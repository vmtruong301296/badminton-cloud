<?php

namespace Tests\Feature;

use App\Models\FuelPrice;
use App\Models\User;
use App\Services\FuelPrice\FuelPriceService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Tests\TestCase;

class FuelPriceServiceTest extends TestCase
{
    use RefreshDatabase;

    private const KEY = 'e10_ron95_iii';

    private FuelPriceService $service;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();
        $this->service = app(FuelPriceService::class);
    }

    private function baoHaTinhHtml(int $price = 22660, string $date = '21/08/2026'): string
    {
        $formatted = number_format($price, 0, ',', '.');

        return '<meta name="description" content="Giá Xăng E10 RON 95-III hôm nay '
            .$date.' ở mức '.$formatted.' đồng/lít, tăng 550 đ so kỳ trước.">';
    }

    private function petrolimexJson(int $price = 22660): string
    {
        return json_encode(['Objects' => [[
            'Title' => 'Xăng E10 RON 95-III',
            'Zone1Price' => $price,
            'Zone2Price' => $price + 390,
            // Petrolimex sửa giá chiều thứ Năm 20/08; baohatinh.vn cào ngày
            // hôm sau vẫn ghi "hôm nay 21/08/2026".
            'LastModified' => '2026-08-20T07:50:29.63Z',
        ]]]);
    }

    private function fakeSources(?string $baoHaTinh, ?string $petrolimex): void
    {
        Http::fake([
            'baohatinh.vn/*' => $baoHaTinh === null
                ? Http::response('', 500)
                : Http::response($baoHaTinh, 200),
            'portals.petrolimex.com.vn/*' => $petrolimex === null
                ? Http::response('', 500)
                : Http::response($petrolimex, 200),
        ]);
    }

    private function seedExisting(int $price = 20000): FuelPrice
    {
        return FuelPrice::create([
            'fuel_key' => self::KEY,
            'price' => $price,
            'sources' => ['cũ' => $price],
            'fetched_at' => now()->subDays(3),
            'last_checked_at' => now()->subDays(3),
        ]);
    }

    public function test_hai_nguon_khop_thi_cap_nhat_gia(): void
    {
        $this->seedExisting();
        $this->fakeSources($this->baoHaTinhHtml(), $this->petrolimexJson());

        $result = $this->service->refresh(self::KEY);

        $this->assertSame(22660, $result->price);
        // assertEquals không xét thứ tự key: cột JSON của MySQL tự sắp lại key.
        $this->assertEquals(
            ['petrolimex.com.vn' => 22660, 'baohatinh.vn' => 22660],
            $result->sources
        );
        $this->assertNull($result->last_error);
        $this->assertNotNull($result->fetched_at);
        $this->assertSame(
            '2026-08-20',
            $result->source_date->format('Y-m-d'),
            'ngày Petrolimex điều chỉnh giá, không phải ngày "hôm nay" của baohatinh.vn'
        );
    }

    public function test_hai_nguon_lech_thi_giu_gia_cu(): void
    {
        $this->seedExisting(20000);
        $this->fakeSources($this->baoHaTinhHtml(22660), $this->petrolimexJson(22500));

        $result = $this->service->refresh(self::KEY);

        $this->assertSame(20000, $result->price, 'giá cũ phải giữ nguyên');
        $this->assertStringContainsString('lệch nhau', $result->last_error);
        $this->assertStringContainsString('22.660', $result->last_error);
        $this->assertStringContainsString('22.500', $result->last_error);
    }

    public function test_mot_nguon_loi_thi_giu_gia_cu(): void
    {
        $this->seedExisting(20000);
        $this->fakeSources($this->baoHaTinhHtml(), null);

        $result = $this->service->refresh(self::KEY);

        $this->assertSame(20000, $result->price);
        $this->assertStringContainsString('1/2', $result->last_error);
        $this->assertStringContainsString('petrolimex.com.vn', $result->last_error);
    }

    public function test_nguon_tra_ma_loi_http_thi_ghi_log_kem_ma(): void
    {
        // Đúng tình huống giavangnay.com: trả 530 suốt 56 ngày mà log trống trơn.
        Log::spy();
        Http::fake([
            'baohatinh.vn/*' => Http::response($this->baoHaTinhHtml(), 200),
            'portals.petrolimex.com.vn/*' => Http::response('error code: 1016', 530),
        ]);

        $this->service->refresh(self::KEY);

        Log::shouldHaveReceived('warning')->once()->withArgs(
            fn (string $message, array $context) => $context['source'] === 'petrolimex.com.vn'
                && $context['fuel_key'] === self::KEY
                && $context['status'] === 530
        );
    }

    public function test_nguon_tra_noi_dung_khong_doc_duoc_thi_ghi_log(): void
    {
        // HTTP 200 nhưng không tìm thấy giá: nguồn đổi cấu trúc, cũng phải lộ ra log.
        Log::spy();
        $this->fakeSources($this->baoHaTinhHtml(), '{"Objects":[]}');

        $this->service->refresh(self::KEY);

        Log::shouldHaveReceived('warning')->once()->withArgs(
            fn (string $message, array $context) => $context['source'] === 'petrolimex.com.vn'
                && $context['status'] === 200
        );
    }

    public function test_hai_nguon_tot_thi_khong_ghi_log(): void
    {
        Log::spy();
        $this->fakeSources($this->baoHaTinhHtml(), $this->petrolimexJson());

        $this->service->refresh(self::KEY);

        Log::shouldNotHaveReceived('warning');
    }

    public function test_ca_hai_nguon_loi_thi_giu_gia_cu(): void
    {
        $this->seedExisting(20000);
        $this->fakeSources(null, null);

        $result = $this->service->refresh(self::KEY);

        $this->assertSame(20000, $result->price);
        $this->assertStringContainsString('Cả hai nguồn', $result->last_error);
    }

    public function test_moi_nhanh_deu_cap_nhat_last_checked_at(): void
    {
        $existing = $this->seedExisting();
        $before = $existing->last_checked_at;

        $this->fakeSources(null, null);
        $result = $this->service->refresh(self::KEY);

        $this->assertTrue($result->last_checked_at->greaterThan($before));
    }

    public function test_chua_co_ban_ghi_thi_tao_moi_tu_fallback(): void
    {
        $this->fakeSources($this->baoHaTinhHtml(), $this->petrolimexJson());

        $result = $this->service->refresh(self::KEY);

        $this->assertSame(22660, $result->price);
        $this->assertSame(1, FuelPrice::count());
    }

    public function test_chua_co_ban_ghi_va_cao_that_bai_thi_dung_fallback_config(): void
    {
        $this->fakeSources(null, null);

        $result = $this->service->refresh(self::KEY);

        $this->assertSame(config('fuel_prices.types.e10_ron95_iii.fallback_price'), $result->price);
        $this->assertNull($result->fetched_at);
    }

    public function test_set_manually_ghi_updated_by_va_xoa_sources(): void
    {
        $this->seedExisting();
        $user = User::create(['name' => 'Admin', 'email' => 'a@b.test', 'password' => 'secret123']);

        $result = $this->service->setManually(self::KEY, 23000, $user->id);

        $this->assertSame(23000, $result->price);
        $this->assertSame($user->id, $result->updated_by);
        $this->assertTrue($result->isManual());
        $this->assertNull($result->sources);
        $this->assertNull($result->last_error);
    }

    public function test_cao_thanh_cong_ghi_de_gia_nhap_tay(): void
    {
        $user = User::create(['name' => 'Admin', 'email' => 'a@b.test', 'password' => 'secret123']);
        $this->service->setManually(self::KEY, 30000, $user->id);

        $this->fakeSources($this->baoHaTinhHtml(), $this->petrolimexJson());
        $result = $this->service->refresh(self::KEY);

        $this->assertSame(22660, $result->price);
        $this->assertNull($result->updated_by, 'cào thành công thì hết là giá tay');
        $this->assertFalse($result->isManual());
    }

    public function test_cao_that_bai_thi_giu_nguyen_gia_nhap_tay(): void
    {
        $user = User::create(['name' => 'Admin', 'email' => 'a@b.test', 'password' => 'secret123']);
        $this->service->setManually(self::KEY, 30000, $user->id);

        $this->fakeSources(null, null);
        $result = $this->service->refresh(self::KEY);

        $this->assertSame(30000, $result->price);
        $this->assertSame($user->id, $result->updated_by);
    }

    public function test_is_stale_theo_nguong_10_ngay(): void
    {
        $price = $this->seedExisting();

        $price->fetched_at = now()->subDays(9);
        $this->assertFalse($price->isStale());

        $price->fetched_at = now()->subDays(11);
        $this->assertTrue($price->isStale());

        $price->fetched_at = null;
        $this->assertTrue($price->isStale(), 'chưa cào được lần nào cũng là cũ');
    }

    public function test_current_dung_cache_khong_goi_lai_mang(): void
    {
        $this->fakeSources($this->baoHaTinhHtml(), $this->petrolimexJson());

        $this->service->current(self::KEY);
        $this->service->current(self::KEY);

        // 2 nguồn x 1 lần = 2 request; lần gọi thứ hai phải lấy từ cache.
        Http::assertSentCount(2);
    }
}
