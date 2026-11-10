<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Giá sân (Master → Giá sân): đơn giá một sân cho 2 giờ, lên giá theo ngày áp dụng như loại cầu.
 * Bill con tính tiền sân theo giờ bằng mốc giá mới nhất không sau ngày bill.
 */
class CourtPriceTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->adminUser();
    }

    public function test_mac_dinh_co_moc_140k_ap_dung_tu_truoc_toi_nay(): void
    {
        $this->actingAs($this->admin)
            ->getJson('/api/court-prices')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.effective_from', '1970-01-01')
            ->assertJsonPath('0.price', 140000);
    }

    public function test_len_gia_them_moc_moi_tra_ve_lich_gia_moi_nhat_truoc(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/court-prices', ['effective_from' => '2026-12-01', 'price' => 150000])
            ->assertCreated()
            ->assertJsonCount(2)
            ->assertJsonPath('0.effective_from', '2026-12-01')
            ->assertJsonPath('0.price', 150000)
            ->assertJsonPath('1.effective_from', '1970-01-01')
            ->assertJsonPath('1.price', 140000);
    }

    public function test_len_gia_trung_ngay_ap_dung_thi_sua_gia_cua_moc_do(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/court-prices', ['effective_from' => '2026-12-01', 'price' => 150000])
            ->assertCreated();

        $this->actingAs($this->admin)
            ->postJson('/api/court-prices', ['effective_from' => '2026-12-01', 'price' => 160000])
            ->assertCreated()
            ->assertJsonCount(2)
            ->assertJsonPath('0.price', 160000);
    }

    public function test_xoa_moc_gia(): void
    {
        $id = $this->actingAs($this->admin)
            ->postJson('/api/court-prices', ['effective_from' => '2026-12-01', 'price' => 150000])
            ->json('0.id');

        $this->actingAs($this->admin)
            ->deleteJson("/api/court-prices/{$id}")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.price', 140000);
    }

    public function test_khong_xoa_duoc_moc_gia_cuoi_cung(): void
    {
        $id = $this->actingAs($this->admin)->getJson('/api/court-prices')->json('0.id');

        $this->actingAs($this->admin)
            ->deleteJson("/api/court-prices/{$id}")
            ->assertStatus(422)
            ->assertJsonPath('message', 'Phải giữ ít nhất một mốc giá sân.');

        $this->actingAs($this->admin)->getJson('/api/court-prices')->assertJsonCount(1);
    }

    public function test_len_gia_can_ngay_ap_dung_va_gia_lon_hon_0(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/court-prices', ['price' => 0])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['effective_from', 'price']);
    }
}
