<?php

namespace Tests\Feature;

use App\Models\ShuttleType;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Collection;
use Tests\TestCase;

/**
 * Bill chia theo trận (bill con hoặc bill chính): nhập tiền sân chung + từng trận (người đánh, một
 * hoặc nhiều loại cầu + số quả). Tiền sân chia đều theo trận, mỗi trận chia cho người đánh trận
 * đó; tiền cầu của trận chia cho người đánh trận đó.
 */
class BillMatchSplitTest extends TestCase
{
    use RefreshDatabase;

    private const STOCK = 100;

    private User $admin;

    /** @var Collection<string, User> */
    private Collection $players;

    private ShuttleType $s70;

    private ShuttleType $thanhCong;

    private int $parentId;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = $this->adminUser(['name' => 'Admin test']);
        $this->players = collect(['Trường', 'Nguyên', 'Hiển', 'Huỳnh', 'Lộc', 'Tân'])
            ->mapWithKeys(fn (string $name) => [$name => User::create([
                'name' => $name,
                'email' => 'p-'.md5($name).'@example.test',
                'password' => 'secret123',
            ])]);
        $this->s70 = ShuttleType::create(['name' => 'Cầu S70', 'price' => 26000, 'stock_quantity' => self::STOCK]);
        $this->thanhCong = ShuttleType::create(['name' => 'Cầu Thành Công', 'price' => 28000, 'stock_quantity' => self::STOCK]);

        $this->parentId = $this->actingAs($this->admin)
            ->postJson('/api/bills', [
                'date' => '2026-11-08',
                'court_total' => 280000,
                'shuttles' => [],
                'players' => $this->players->map(fn (User $u) => ['user_id' => $u->id, 'ratio_value' => 1])->values()->all(),
            ])
            ->assertStatus(201)
            ->json('id');
    }

    private function id(string $name): int
    {
        return $this->players[$name]->id;
    }

    private function match(array $names, ShuttleType $type, int $quantity): array
    {
        return $this->matchWith($names, [[$type, $quantity]]);
    }

    /** @param  array<int, array{0: ShuttleType, 1: int}>  $lines  các loại cầu của trận: [loại, số quả] */
    private function matchWith(array $names, array $lines): array
    {
        return [
            'player_ids' => array_map(fn (string $n) => $this->id($n), $names),
            'shuttles' => array_map(fn (array $line) => [
                'shuttle_type_id' => $line[0]->id,
                'quantity' => $line[1],
            ], $lines),
        ];
    }

    /** Ví dụ của chủ dự án: sân 55k, trận 1 một quả S70, trận 2 hai quả Thành Công. */
    private function examplePayload(array $override = []): array
    {
        return array_merge([
            'date' => '2026-11-08',
            'note' => 'Sau 9h',
            'court_total' => 55000,
            'split_mode' => 'match',
            'matches' => [
                $this->match(['Trường', 'Nguyên', 'Hiển', 'Huỳnh'], $this->s70, 1),
                $this->match(['Trường', 'Hiển', 'Lộc', 'Tân'], $this->thanhCong, 2),
            ],
        ], $override);
    }

    private function createSubBill(array $payload): array
    {
        return $this->actingAs($this->admin)
            ->postJson("/api/bills/{$this->parentId}/sub-bills", $payload)
            ->assertStatus(201)
            ->json();
    }

    /** @return array<string, array<string, mixed>> bill_players theo tên người chơi */
    private function playersByName(array $bill): array
    {
        return collect($bill['bill_players'])->keyBy('user.name')->all();
    }

    public function test_tao_bill_con_theo_tran_chia_dung_vi_du(): void
    {
        $bill = $this->createSubBill($this->examplePayload());

        $this->assertSame('match', $bill['split_mode']);
        $this->assertSame($this->parentId, $bill['parent_bill_id']);
        $this->assertSame(26000 + 56000, $bill['total_shuttle_price']);
        $this->assertSame(55000 + 82000, $bill['total_amount']);

        $players = $this->playersByName($bill);
        $expected = [
            'Trường' => [34250, 2], 'Nguyên' => [13375, 1], 'Hiển' => [34250, 2],
            'Huỳnh' => [13375, 1], 'Lộc' => [20875, 1], 'Tân' => [20875, 1],
        ];
        $this->assertSame(array_keys($expected), array_keys($players), 'Người chơi xếp theo lần đầu xuất hiện');
        foreach ($expected as $name => [$amount, $matchCount]) {
            $this->assertSame($amount, $players[$name]['share_amount'], $name);
            $this->assertSame($amount, $players[$name]['total_amount'], $name);
            $this->assertEquals($matchCount, $players[$name]['ratio_value'], "Số trận của {$name}");
            $this->assertSame(0, $players[$name]['menu_extra_total'], $name);
        }
    }

    public function test_tao_bill_chinh_theo_tran_khong_can_bill_cha(): void
    {
        $bill = $this->actingAs($this->admin)
            ->postJson('/api/bills', $this->examplePayload())
            ->assertStatus(201)
            ->json();

        $this->assertSame('match', $bill['split_mode']);
        $this->assertNull($bill['parent_bill_id']);
        $this->assertSame(55000 + 82000, $bill['total_amount']);
        $this->assertCount(2, $bill['matches']);
        $this->assertSame(34250, $this->playersByName($bill)['Trường']['share_amount']);
        $this->assertSame(self::STOCK - 1, $this->s70->fresh()->stock_quantity);
        $this->assertSame(self::STOCK - 2, $this->thanhCong->fresh()->stock_quantity);

        // Là bill chính: tạo được bill con từ nó
        $sub = $this->actingAs($this->admin)
            ->postJson("/api/bills/{$bill['id']}/sub-bills", $this->examplePayload(['court_total' => 40000]))
            ->assertStatus(201)
            ->json();
        $this->assertSame($bill['id'], $sub['parent_bill_id']);
    }

    public function test_luu_tung_tran_va_gop_chi_tiet_cau_theo_loai(): void
    {
        $bill = $this->createSubBill($this->examplePayload([
            'matches' => [
                $this->match(['Trường', 'Nguyên', 'Hiển', 'Huỳnh'], $this->s70, 1),
                $this->match(['Trường', 'Hiển', 'Lộc', 'Tân'], $this->thanhCong, 2),
                $this->match(['Trường', 'Lộc'], $this->s70, 1),
            ],
        ]));

        $this->assertCount(3, $bill['matches']);
        $this->assertSame([1, 2, 3], array_column($bill['matches'], 'position'));
        $this->assertSame(28000 * 2, $bill['matches'][1]['subtotal']);
        $this->assertSame(['Trường', 'Lộc'], array_column($bill['matches'][2]['players'], 'name'));
        $this->assertSame('Cầu Thành Công', $bill['matches'][1]['shuttles'][0]['shuttle_type']['name']);

        $shuttles = collect($bill['bill_shuttles'])->keyBy('shuttle_type_id');
        $this->assertSame(2, $shuttles[$this->s70->id]['quantity']);
        $this->assertSame(52000, $shuttles[$this->s70->id]['subtotal']);
        $this->assertSame(2, $shuttles[$this->thanhCong->id]['quantity']);

        $this->assertSame(self::STOCK - 2, $this->s70->fresh()->stock_quantity);
        $this->assertSame(self::STOCK - 2, $this->thanhCong->fresh()->stock_quantity);
    }

    public function test_tran_don_chia_cho_2_nguoi(): void
    {
        $bill = $this->createSubBill($this->examplePayload([
            'court_total' => 60000,
            'matches' => [
                $this->match(['Trường', 'Nguyên', 'Hiển', 'Huỳnh'], $this->s70, 1),
                $this->match(['Trường', 'Nguyên'], $this->thanhCong, 1),
            ],
        ]));

        $players = $this->playersByName($bill);
        // Trận 1: 30.000/4 + 26.000/4 = 14.000; trận 2: 30.000/2 + 28.000/2 = 29.000
        $this->assertSame(14000 + 29000, $players['Trường']['total_amount']);
        $this->assertSame(14000, $players['Huỳnh']['total_amount']);
    }

    public function test_mot_tran_dung_nhieu_loai_cau(): void
    {
        $bill = $this->createSubBill($this->examplePayload([
            'court_total' => 40000,
            'matches' => [
                $this->matchWith(['Trường', 'Nguyên', 'Hiển', 'Huỳnh'], [[$this->s70, 1], [$this->thanhCong, 1]]),
                $this->match(['Trường', 'Hiển', 'Lộc', 'Tân'], $this->s70, 1),
            ],
        ]));

        $this->assertSame(26000 + 28000, $bill['matches'][0]['subtotal']);
        $this->assertSame(
            [['Cầu S70', 1, 26000], ['Cầu Thành Công', 1, 28000]],
            array_map(fn (array $line) => [$line['shuttle_type']['name'], $line['quantity'], $line['subtotal']], $bill['matches'][0]['shuttles']),
        );
        $this->assertSame(54000 + 26000, $bill['total_shuttle_price']);

        // Trận 1: (20.000 + 54.000) / 4 = 18.500; trận 2: (20.000 + 26.000) / 4 = 11.500
        $players = $this->playersByName($bill);
        $this->assertSame(18500 + 11500, $players['Trường']['share_amount']);
        $this->assertSame(18500, $players['Nguyên']['share_amount']);
        $this->assertSame(11500, $players['Lộc']['share_amount']);

        $shuttles = collect($bill['bill_shuttles'])->keyBy('shuttle_type_id');
        $this->assertSame(2, $shuttles[$this->s70->id]['quantity']);
        $this->assertSame(1, $shuttles[$this->thanhCong->id]['quantity']);
        $this->assertSame(self::STOCK - 2, $this->s70->fresh()->stock_quantity);
        $this->assertSame(self::STOCK - 1, $this->thanhCong->fresh()->stock_quantity);
    }

    public function test_mot_loai_cau_khong_duoc_chon_hai_lan_trong_mot_tran(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/api/bills/{$this->parentId}/sub-bills", $this->examplePayload([
                'matches' => [$this->matchWith(['Trường', 'Nguyên', 'Hiển', 'Huỳnh'], [[$this->s70, 1], [$this->s70, 2]])],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['matches.0.shuttles' => 'Trận 1 có loại cầu bị chọn hai lần.']);
    }

    public function test_tran_can_it_nhat_mot_loai_cau(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/api/bills/{$this->parentId}/sub-bills", $this->examplePayload([
                'matches' => [$this->matchWith(['Trường', 'Nguyên', 'Hiển', 'Huỳnh'], [])],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['matches.0.shuttles' => 'Mỗi trận cần ít nhất một loại cầu.']);
    }

    public function test_tran_phai_du_4_hoac_2_nguoi(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/api/bills/{$this->parentId}/sub-bills", $this->examplePayload([
                'matches' => [$this->match(['Trường', 'Nguyên', 'Hiển'], $this->s70, 1)],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['matches.0.player_ids']);
    }

    public function test_mot_nguoi_khong_duoc_chon_hai_lan_trong_mot_tran(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/api/bills/{$this->parentId}/sub-bills", $this->examplePayload([
                'matches' => [$this->match(['Trường', 'Trường', 'Hiển', 'Huỳnh'], $this->s70, 1)],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['matches.0.player_ids' => 'Trận 1 có người bị chọn hai lần.']);
    }

    public function test_chia_theo_tran_can_it_nhat_mot_tran(): void
    {
        $this->actingAs($this->admin)
            ->postJson("/api/bills/{$this->parentId}/sub-bills", $this->examplePayload(['matches' => []]))
            ->assertStatus(422)
            ->assertJsonValidationErrors(['matches']);
    }

    public function test_sua_bill_theo_tran_tinh_lai_tien_kho_cau_va_giu_da_tt(): void
    {
        $bill = $this->createSubBill($this->examplePayload());
        $this->actingAs($this->admin)
            ->postJson("/api/bills/{$bill['id']}/players/{$this->id('Trường')}/pay", ['is_paid' => true])
            ->assertOk();

        $updated = $this->actingAs($this->admin)
            ->putJson("/api/bills/{$bill['id']}", $this->examplePayload([
                'matches' => [$this->match(['Trường', 'Nguyên', 'Lộc', 'Tân'], $this->s70, 2)],
            ]))
            ->assertOk()
            ->json();

        $this->assertSame('match', $updated['split_mode']);
        $this->assertCount(1, $updated['matches']);
        $players = $this->playersByName($updated);
        $this->assertSame(['Trường', 'Nguyên', 'Lộc', 'Tân'], array_keys($players));
        // 55.000/4 + 52.000/4
        $this->assertSame(26750, $players['Trường']['total_amount']);
        $this->assertTrue($players['Trường']['is_paid']);
        $this->assertFalse($players['Lộc']['is_paid']);

        $this->assertSame(self::STOCK - 2, $this->s70->fresh()->stock_quantity);
        $this->assertSame(self::STOCK, $this->thanhCong->fresh()->stock_quantity);
    }

    public function test_doi_bill_theo_tran_ve_muc_tinh_thi_bo_cac_tran(): void
    {
        $bill = $this->createSubBill($this->examplePayload());

        $updated = $this->actingAs($this->admin)
            ->putJson("/api/bills/{$bill['id']}", [
                'date' => '2026-11-08',
                'court_total' => 55000,
                'shuttles' => [['shuttle_type_id' => $this->s70->id, 'quantity' => 1]],
                'players' => [['user_id' => $this->id('Trường'), 'ratio_value' => 1]],
            ])
            ->assertOk();

        $this->assertDatabaseHas('bills', ['id' => $bill['id'], 'split_mode' => 'ratio']);
        $this->assertDatabaseCount('bill_matches', 0);
        $this->assertDatabaseCount('bill_match_players', 0);
        $this->assertSame(81000, $updated->json('total_amount'));
    }

    public function test_chi_tiet_bill_chinh_tra_kem_cac_tran_cua_bill_con(): void
    {
        $sub = $this->createSubBill($this->examplePayload());

        $this->actingAs($this->admin)
            ->getJson("/api/bills/{$this->parentId}")
            ->assertOk()
            ->assertJsonPath('sub_bills.0.split_mode', 'match')
            ->assertJsonPath('sub_bills.0.matches.1.players.3.name', 'Tân')
            ->assertJsonPath('sub_bills.0.matches.0.shuttles.0.shuttle_type.name', 'Cầu S70');

        $this->actingAs($this->admin)
            ->getJson("/api/bills/{$sub['id']}")
            ->assertOk()
            ->assertJsonPath('matches.0.players.0.name', 'Trường');
    }

    public function test_xoa_bill_theo_tran_hoan_kho_va_xoa_tran(): void
    {
        $bill = $this->createSubBill($this->examplePayload());

        $this->actingAs($this->admin)->deleteJson("/api/bills/{$bill['id']}")->assertOk();

        $this->assertSame(self::STOCK, $this->s70->fresh()->stock_quantity);
        $this->assertSame(self::STOCK, $this->thanhCong->fresh()->stock_quantity);
        $this->assertDatabaseCount('bill_matches', 0);
        $this->assertDatabaseCount('bill_match_players', 0);
    }

    public function test_bill_tao_kieu_cu_mac_dinh_chia_theo_muc_tinh(): void
    {
        $this->assertDatabaseHas('bills', ['id' => $this->parentId, 'split_mode' => 'ratio']);
    }
}
