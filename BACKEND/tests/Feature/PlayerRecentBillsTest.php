<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * GET /api/players trả recent_bill_rank: bill gần nhất người đó có mặt trong 10 bill chính
 * mới nhất (1 = mới nhất), để danh sách chọn người của bill chính hiện người đánh gần đây.
 */
class PlayerRecentBillsTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();
        $this->admin = $this->adminUser(['name' => 'Admin test']);
    }

    private function player(string $name): User
    {
        return User::create([
            'name' => $name,
            'email' => 'p-'.md5($name).'@example.test',
            'password' => 'secret123',
        ]);
    }

    /** @param  array<int, User>  $players */
    private function bill(string $date, array $players, ?int $parentId = null): int
    {
        return $this->actingAs($this->admin)
            ->postJson('/api/bills', [
                'date' => $date,
                'court_total' => 100000,
                'shuttles' => [],
                'parent_bill_id' => $parentId,
                'players' => array_map(fn (User $u) => ['user_id' => $u->id, 'ratio_value' => 1], $players),
            ])
            ->assertStatus(201)
            ->json('id');
    }

    /** @return array<string, int|null> tên => recent_bill_rank */
    private function ranks(): array
    {
        return collect($this->actingAs($this->admin)->getJson('/api/players')->assertOk()->json())
            ->pluck('recent_bill_rank', 'name')
            ->all();
    }

    public function test_hang_theo_bill_gan_nhat_nguoi_do_co_mat_trong_10_bill_chinh(): void
    {
        $cu = $this->player('Chỉ đánh bill cũ');
        $deu = $this->player('Đánh đều');
        $moi = $this->player('Mới đánh hôm qua');
        $chiBillCon = $this->player('Chỉ có trong bill con');

        // 12 bill chính, ngày 01..12: "Chỉ đánh bill cũ" chỉ có ở bill ngày 01 (ngoài 10 bill mới nhất)
        $this->bill('2026-10-01', [$cu, $deu]);
        for ($day = 2; $day <= 11; $day++) {
            $this->bill(sprintf('2026-10-%02d', $day), [$deu]);
        }
        $latest = $this->bill('2026-10-12', [$moi]);
        // Bill con không tính
        $this->bill('2026-10-12', [$moi, $chiBillCon], $latest);

        $ranks = $this->ranks();
        $this->assertSame(1, $ranks['Mới đánh hôm qua']);
        $this->assertSame(2, $ranks['Đánh đều'], 'Bill gần nhất của người này là bill ngày 11');
        $this->assertNull($ranks['Chỉ đánh bill cũ'], 'Ngoài 10 bill chính mới nhất');
        $this->assertNull($ranks['Chỉ có trong bill con']);
    }

    public function test_cung_ngay_thi_bill_tao_sau_moi_hon(): void
    {
        $sang = $this->player('Đánh sáng');
        $toi = $this->player('Đánh tối');
        $this->bill('2026-10-20', [$sang]);
        $this->bill('2026-10-20', [$toi]);

        $ranks = $this->ranks();
        $this->assertSame(1, $ranks['Đánh tối']);
        $this->assertSame(2, $ranks['Đánh sáng']);
    }
}
