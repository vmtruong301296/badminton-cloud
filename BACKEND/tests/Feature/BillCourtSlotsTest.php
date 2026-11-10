<?php

namespace Tests\Feature;

use App\Models\ShuttleType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Tests\TestCase;

/**
 * Khung giờ sân của bill con (court_slots): bảng "Tính theo giờ" lưu kèm bill để mở lại sửa
 * vẫn thấy các sân đã chọn. Tiền sân vẫn là court_total người dùng gửi lên (có thể gõ tay khác
 * số tính theo giờ), máy chủ không tự tính lại từ khung giờ.
 */
class BillCourtSlotsTest extends TestCase
{
    use RefreshDatabase;

    private const SLOTS = [
        ['start' => '21:00', 'end' => '21:10'],
        ['start' => '21:00', 'end' => '21:22'],
    ];

    private User $admin;

    /** @var Collection<int, User> */
    private Collection $players;

    private ShuttleType $s70;

    private int $parentId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->adminUser();
        $this->players = collect(range(1, 4))->map(fn (int $i) => User::create([
            'name' => "Người {$i}",
            'email' => "nguoi-{$i}@example.test",
            'password' => 'secret123',
        ]));
        $this->s70 = ShuttleType::create(['name' => 'Cầu S70', 'price' => 26000, 'stock_quantity' => 100]);

        $this->parentId = $this->actingAs($this->admin)
            ->postJson('/api/bills', $this->ratioPayload(['court_total' => 280000]))
            ->assertCreated()
            ->json('id');
    }

    private function ratioPayload(array $override = []): array
    {
        return array_merge([
            'date' => '2026-11-10',
            'court_total' => 38000,
            'shuttles' => [],
            'players' => $this->players->map(fn (User $u) => ['user_id' => $u->id, 'ratio_value' => 1])->all(),
        ], $override);
    }

    private function matchPayload(array $override = []): array
    {
        return array_merge([
            'date' => '2026-11-10',
            'court_total' => 38000,
            'split_mode' => 'match',
            'matches' => [[
                'player_ids' => $this->players->pluck('id')->all(),
                'shuttles' => [['shuttle_type_id' => $this->s70->id, 'quantity' => 1]],
            ]],
        ], $override);
    }

    private function createSubBill(array $payload): int
    {
        return $this->actingAs($this->admin)
            ->postJson('/api/bills', [...$payload, 'parent_bill_id' => $this->parentId])
            ->assertCreated()
            ->json('id');
    }

    private function courtSlots(int $billId): mixed
    {
        return $this->actingAs($this->admin)->getJson("/api/bills/{$billId}")->assertOk()->json('court_slots');
    }

    public function test_bill_con_theo_muc_tinh_luu_khung_gio_san(): void
    {
        $id = $this->createSubBill($this->ratioPayload(['court_slots' => self::SLOTS]));

        $this->assertSame(self::SLOTS, $this->courtSlots($id));
    }

    public function test_bill_con_theo_tran_luu_khung_gio_san(): void
    {
        $id = $this->createSubBill($this->matchPayload(['court_slots' => self::SLOTS]));

        $this->assertSame(self::SLOTS, $this->courtSlots($id));
    }

    public function test_tien_san_giu_so_nguoi_dung_gui_khong_tinh_lai_tu_khung_gio(): void
    {
        $id = $this->createSubBill($this->ratioPayload(['court_total' => 45000, 'court_slots' => self::SLOTS]));

        $this->actingAs($this->admin)->getJson("/api/bills/{$id}")->assertJsonPath('court_total', 45000);
    }

    public function test_sua_bill_con_thay_khung_gio_moi_hoac_xoa_het(): void
    {
        $id = $this->createSubBill($this->matchPayload(['court_slots' => self::SLOTS]));
        $newSlots = [['start' => '21:00', 'end' => '21:30']];

        $this->actingAs($this->admin)
            ->putJson("/api/bills/{$id}", $this->matchPayload(['court_slots' => $newSlots]))
            ->assertOk();
        $this->assertSame($newSlots, $this->courtSlots($id));

        $this->actingAs($this->admin)
            ->putJson("/api/bills/{$id}", $this->ratioPayload(['court_slots' => []]))
            ->assertOk();
        $this->assertNull($this->courtSlots($id));
    }

    public function test_bill_khong_gui_khung_gio_thi_de_trong(): void
    {
        $this->assertNull($this->courtSlots($this->parentId));
    }

    public function test_tu_choi_khung_gio_sai_dinh_dang_hoac_ket_thuc_khong_sau_bat_dau(): void
    {
        $this->actingAs($this->admin)
            ->postJson('/api/bills', $this->ratioPayload(['court_slots' => [
                ['start' => '9h', 'end' => '21:10'],
                ['start' => '21:00', 'end' => '20:50'],
            ]]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['court_slots.0.start', 'court_slots.1.end']);
    }
}
