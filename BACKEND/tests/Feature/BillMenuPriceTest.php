<?php

namespace Tests\Feature;

use App\Models\Menu;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sửa bill không được tự đổi tiền nước theo giá menu hiện tại: món đã có trong
 * bill giữ giá lúc tạo bill, món chưa có mới lấy giá hiện tại.
 */
class BillMenuPriceTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Menu $sting;

    private int $billId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create(['name' => 'Người test', 'email' => 'test@example.com', 'password' => 'secret123']);
        $this->sting = Menu::create(['name' => 'Sting', 'price' => 15000]);

        $this->billId = $this->actingAs($this->user)
            ->postJson('/api/bills', $this->payload([['menu_id' => $this->sting->id, 'quantity' => 2]]))
            ->assertStatus(201)
            ->json('id');

        // Giá menu tăng sau khi đã tạo bill
        $this->sting->update(['price' => 17000]);
    }

    private function payload(array $menus): array
    {
        return [
            'date' => '2026-10-18',
            'court_total' => 200000,
            'shuttles' => [],
            'players' => [['user_id' => $this->user->id, 'ratio_value' => 1, 'menus' => $menus]],
        ];
    }

    private function updateBill(array $menus): array
    {
        return $this->actingAs($this->user)
            ->putJson("/api/bills/{$this->billId}", $this->payload($menus))
            ->assertStatus(200)
            ->json('bill_players.0');
    }

    public function test_sua_bill_giu_gia_nuoc_luc_tao_bill(): void
    {
        $player = $this->updateBill([['menu_id' => $this->sting->id, 'quantity' => 2]]);

        $this->assertSame(15000, $player['bill_player_menus'][0]['price_each']);
        $this->assertSame(30000, $player['bill_player_menus'][0]['subtotal']);
        $this->assertSame(30000, $player['menu_extra_total']);
        $this->assertSame(200000 + 30000, $player['total_amount']);
    }

    public function test_doi_so_luong_mon_da_co_van_giu_gia_cu(): void
    {
        $player = $this->updateBill([
            ['menu_id' => $this->sting->id, 'quantity' => 2],
            ['menu_id' => $this->sting->id, 'quantity' => 1],
        ]);

        $this->assertSame([15000, 15000], array_column($player['bill_player_menus'], 'price_each'));
        $this->assertSame(45000, $player['menu_extra_total']);
    }

    public function test_mon_chua_co_trong_bill_lay_gia_hien_tai(): void
    {
        $revive = Menu::create(['name' => 'Revive', 'price' => 20000]);

        $player = $this->updateBill([
            ['menu_id' => $this->sting->id, 'quantity' => 2],
            ['menu_id' => $revive->id, 'quantity' => 1],
        ]);

        $prices = array_column($player['bill_player_menus'], 'price_each', 'menu_id');
        $this->assertSame(15000, $prices[$this->sting->id]);
        $this->assertSame(20000, $prices[$revive->id]);
        $this->assertSame(30000 + 20000, $player['menu_extra_total']);
    }
}
