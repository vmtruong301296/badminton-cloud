<?php

namespace Tests\Feature;

use App\Models\Menu;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Trạng thái bật/tắt của menu nước: món tắt bị ẩn khỏi ô chọn khi tạo / sửa bill
 * (lọc ở giao diện), nhưng bill cũ đã có món đó vẫn xem và lưu lại được.
 */
class MenuActiveTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create(['name' => 'Người test', 'email' => 'test@example.com', 'password' => 'secret123']);
    }

    public function test_mon_moi_tao_mac_dinh_bat(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/menus', ['name' => 'Trà đá', 'price' => 5000])
            ->assertStatus(201)
            ->assertJsonPath('is_active', true);

        $this->assertTrue(Menu::first()->is_active);
    }

    public function test_danh_sach_tra_ve_trang_thai(): void
    {
        Menu::create(['name' => 'Trà đá', 'price' => 5000]);

        $this->actingAs($this->user())
            ->getJson('/api/menus')
            ->assertStatus(200)
            ->assertJsonPath('0.is_active', true);
    }

    public function test_tat_mon_chi_doi_trang_thai(): void
    {
        $menu = Menu::create(['name' => 'Trà đá', 'price' => 5000]);

        $this->actingAs($this->user())
            ->putJson("/api/menus/{$menu->id}", ['is_active' => false])
            ->assertStatus(200)
            ->assertJsonPath('is_active', false)
            ->assertJsonPath('name', 'Trà đá')
            ->assertJsonPath('price', 5000);

        $this->assertFalse($menu->fresh()->is_active);
    }

    public function test_trang_thai_phai_la_dung_sai(): void
    {
        $menu = Menu::create(['name' => 'Trà đá', 'price' => 5000]);

        $this->actingAs($this->user())
            ->putJson("/api/menus/{$menu->id}", ['is_active' => 'abc'])
            ->assertStatus(422)
            ->assertJsonValidationErrors('is_active');
    }

    public function test_bill_co_mon_da_tat_van_xem_va_luu_lai_duoc(): void
    {
        $user = $this->user();
        $menu = Menu::create(['name' => 'Revive', 'price' => 15000]);

        $payload = [
            'date' => '2026-10-18',
            'court_total' => 200000,
            'shuttles' => [],
            'players' => [
                ['user_id' => $user->id, 'ratio_value' => 1, 'menus' => [['menu_id' => $menu->id, 'quantity' => 2]]],
            ],
        ];

        $billId = $this->actingAs($user)->postJson('/api/bills', $payload)->assertStatus(201)->json('id');

        $menu->update(['is_active' => false]);

        $this->actingAs($user)->putJson("/api/bills/{$billId}", $payload)->assertStatus(200);

        $this->actingAs($user)
            ->getJson("/api/bills/{$billId}")
            ->assertStatus(200)
            ->assertJsonPath('bill_players.0.bill_player_menus.0.menu.name', 'Revive')
            ->assertJsonPath('bill_players.0.bill_player_menus.0.quantity', 2);
    }
}
