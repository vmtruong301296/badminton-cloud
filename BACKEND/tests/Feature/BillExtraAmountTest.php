<?php

namespace Tests\Feature;

use App\Models\Menu;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Mỗi người chơi có thể bị cộng thêm một khoản tiền kèm nội dung (vd "Tiền
 * cộng thêm 10k ở trận trước"). Khoản này nằm trong chi phí thêm cùng với
 * menu nước, cộng vào tổng tiền của người đó.
 */
class BillExtraAmountTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    private Menu $sting;

    protected function setUp(): void
    {
        parent::setUp();

        $this->user = User::create(['name' => 'Người test', 'email' => 'test@example.com', 'password' => 'secret123']);
        $this->sting = Menu::create(['name' => 'Sting', 'price' => 15000]);
    }

    private function payload(array $player): array
    {
        return [
            'date' => '2026-11-03',
            'court_total' => 200000,
            'shuttles' => [],
            'players' => [array_merge(['user_id' => $this->user->id, 'ratio_value' => 1], $player)],
        ];
    }

    private function createBill(array $player): array
    {
        return $this->actingAs($this->user)
            ->postJson('/api/bills', $this->payload($player))
            ->assertStatus(201)
            ->json();
    }

    public function test_tao_bill_cong_them_tien_kem_noi_dung_vao_chi_phi_them(): void
    {
        $player = $this->createBill([
            'menus' => [['menu_id' => $this->sting->id, 'quantity' => 2]],
            'extra_amount' => 10000,
            'extra_note' => 'Tiền cộng thêm 10k ở trận trước',
        ])['bill_players'][0];

        $this->assertSame(10000, $player['extra_amount']);
        $this->assertSame('Tiền cộng thêm 10k ở trận trước', $player['extra_note']);
        $this->assertSame(30000 + 10000, $player['menu_extra_total']);
        $this->assertSame(200000 + 30000 + 10000, $player['total_amount']);
    }

    public function test_cong_them_khong_can_menu_nuoc(): void
    {
        $player = $this->createBill([
            'extra_amount' => 5000,
            'extra_note' => 'Thiếu 5k hôm trước',
        ])['bill_players'][0];

        $this->assertSame(5000, $player['menu_extra_total']);
        $this->assertSame(205000, $player['total_amount']);
    }

    public function test_khong_nhap_thi_cong_them_bang_0(): void
    {
        $player = $this->createBill([])['bill_players'][0];

        $this->assertSame(0, $player['extra_amount']);
        $this->assertNull($player['extra_note']);
        $this->assertSame(0, $player['menu_extra_total']);
        $this->assertSame(200000, $player['total_amount']);
    }

    public function test_sua_bill_doi_duoc_tien_cong_them(): void
    {
        $billId = $this->createBill(['extra_amount' => 10000, 'extra_note' => 'Cũ'])['id'];

        $player = $this->actingAs($this->user)
            ->putJson("/api/bills/{$billId}", $this->payload([
                'menus' => [['menu_id' => $this->sting->id, 'quantity' => 1]],
                'extra_amount' => 20000,
                'extra_note' => 'Mới',
            ]))
            ->assertStatus(200)
            ->json('bill_players.0');

        $this->assertSame(20000, $player['extra_amount']);
        $this->assertSame('Mới', $player['extra_note']);
        $this->assertSame(15000 + 20000, $player['menu_extra_total']);
        $this->assertSame(200000 + 15000 + 20000, $player['total_amount']);
    }

    public function test_noi_dung_cong_them_qua_dai_bi_tu_choi(): void
    {
        $this->actingAs($this->user)
            ->postJson('/api/bills', $this->payload([
                'extra_amount' => 1000,
                'extra_note' => str_repeat('a', 256),
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['players.0.extra_note']);
    }
}
