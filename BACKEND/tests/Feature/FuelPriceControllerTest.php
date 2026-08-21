<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class FuelPriceControllerTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        Cache::flush();

        Http::fake([
            'baohatinh.vn/*' => Http::response(
                '<meta name="description" content="Giá Xăng E10 RON 95-III hôm nay 21/08/2026 ở mức 22.660 đồng/lít, tăng 550 đ.">',
                200
            ),
            'giavangnay.com/*' => Http::response(
                '<table><tr><td><div class="brand-name">Xăng E10 RON 95-III</div></td>'
                .'<td class="price-cell">22.660</td></tr></table>',
                200
            ),
        ]);
    }

    private function user(): User
    {
        return User::create(['name' => 'Người test', 'email' => 'test@example.com', 'password' => 'secret123']);
    }

    public function test_chua_dang_nhap_bi_401(): void
    {
        $this->getJson('/api/fuel-prices')->assertStatus(401);
    }

    public function test_danh_sach_tra_ve_dung_hinh_dang(): void
    {
        $response = $this->actingAs($this->user())
            ->getJson('/api/fuel-prices')
            ->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonPath('0.fuel_key', 'e10_ron95_iii')
            ->assertJsonPath('0.label', 'Xăng E10 RON 95-III')
            ->assertJsonPath('0.price', 22660)
            ->assertJsonPath('0.source_date', '2026-08-21')
            ->assertJsonPath('0.last_error', null)
            ->assertJsonPath('0.is_manual', false)
            ->assertJsonPath('0.is_stale', false)
            ->assertJsonStructure([['fuel_key', 'label', 'price', 'sources', 'source_date',
                'fetched_at', 'last_checked_at', 'last_error', 'is_manual', 'is_stale']]);

        // Tên nguồn có dấu chấm nên không dùng được assertJsonPath (dấu chấm
        // là ký tự phân cấp), kiểm trực tiếp trên mảng.
        $this->assertSame(
            ['baohatinh.vn' => 22660, 'giavangnay.com' => 22660],
            $response->json('0.sources')
        );
    }

    public function test_refresh_buoc_lay_lai(): void
    {
        $user = $this->user();
        $this->actingAs($user)->getJson('/api/fuel-prices');

        $this->actingAs($user)
            ->postJson('/api/fuel-prices/e10_ron95_iii/refresh')
            ->assertStatus(200)
            ->assertJsonPath('price', 22660);

        // 2 nguồn x 2 lần gọi (lần đầu + refresh bỏ qua cache)
        Http::assertSentCount(4);
    }

    public function test_dat_gia_tay(): void
    {
        $this->actingAs($this->user())
            ->putJson('/api/fuel-prices/e10_ron95_iii', ['price' => 23500])
            ->assertStatus(200)
            ->assertJsonPath('price', 23500)
            ->assertJsonPath('is_manual', true)
            ->assertJsonPath('sources', null);
    }

    public function test_gia_ngoai_khoang_bi_422(): void
    {
        $user = $this->user();

        $this->actingAs($user)
            ->putJson('/api/fuel-prices/e10_ron95_iii', ['price' => 999999])
            ->assertStatus(422)
            ->assertJsonValidationErrors('price');

        $this->actingAs($user)
            ->putJson('/api/fuel-prices/e10_ron95_iii', ['price' => 100])
            ->assertStatus(422)
            ->assertJsonValidationErrors('price');
    }

    public function test_loai_nhien_lieu_khong_ton_tai_bi_404(): void
    {
        $this->actingAs($this->user())
            ->putJson('/api/fuel-prices/khong-ton-tai', ['price' => 23000])
            ->assertStatus(404);
    }
}
