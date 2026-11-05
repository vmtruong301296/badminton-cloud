<?php

namespace Tests\Feature;

use App\Models\BillPlayer;
use App\Models\Debt;
use App\Models\Menu;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Sửa bill cầu (PUT /api/bills/{id}) phải giữ "Đã TT" (is_paid + paid_at) của
 * người vẫn còn trong bill (khớp theo user_id). Người mới thêm vào là chưa TT,
 * người bị bỏ khỏi bill thì xóa như cũ. Cách tính tiền không đổi.
 */
class BillUpdatePaidStatusTest extends TestCase
{
    use RefreshDatabase;

    private const PAID_AT = '2026-11-01 20:00:00';

    private User $an;

    private User $binh;

    private User $chi;

    /** Người thu tiền gọi API (route bill cần quyền, xem ApiPermissionTest). */
    private User $thuQuy;

    protected function setUp(): void
    {
        parent::setUp();

        $this->an = User::create(['name' => 'An', 'email' => 'an@example.com', 'password' => 'secret123']);
        $this->binh = User::create(['name' => 'Bình', 'email' => 'binh@example.com', 'password' => 'secret123']);
        $this->chi = User::create(['name' => 'Chi', 'email' => 'chi@example.com', 'password' => 'secret123']);

        $this->thuQuy = $this->adminUser();

        $this->travelTo(self::PAID_AT);
    }

    private function player(User $user, float $ratio = 1, array $extra = []): array
    {
        return array_merge(['user_id' => $user->id, 'ratio_value' => $ratio], $extra);
    }

    private function payload(array $players, array $overrides = []): array
    {
        return array_merge([
            'date' => '2026-11-01',
            'court_total' => 200000,
            'shuttles' => [],
            'players' => $players,
        ], $overrides);
    }

    private function createBill(array $players, array $overrides = []): int
    {
        return $this->actingAs($this->thuQuy)
            ->postJson('/api/bills', $this->payload($players, $overrides))
            ->assertStatus(201)
            ->json('id');
    }

    private function markPayment(int $billId, User $user, bool $isPaid = true): void
    {
        $this->actingAs($this->thuQuy)
            ->postJson("/api/bills/{$billId}/players/{$user->id}/pay", ['is_paid' => $isPaid])
            ->assertStatus(200);
    }

    private function updateBill(int $billId, array $players, array $overrides = []): array
    {
        return $this->actingAs($this->thuQuy)
            ->putJson("/api/bills/{$billId}", $this->payload($players, $overrides))
            ->assertStatus(200)
            ->json();
    }

    private function row(int $billId, User $user): ?BillPlayer
    {
        return BillPlayer::where('bill_id', $billId)->where('user_id', $user->id)->first();
    }

    /** Dòng người chơi trong JSON trả về của bill, theo user_id. */
    private function jsonPlayer(array $bill, User $user): array
    {
        return collect($bill['bill_players'])->firstWhere('user_id', $user->id);
    }

    private function assertPaidAtOriginalTime(int $billId, User $user): void
    {
        $row = $this->row($billId, $user);
        $this->assertTrue($row->is_paid, "{$user->name} phải còn Đã TT");
        $this->assertSame(self::PAID_AT, $row->paid_at?->toDateTimeString(), 'paid_at phải giữ thời điểm TT ban đầu');
    }

    public function test_sua_bill_giu_da_tt_cua_nguoi_da_thanh_toan(): void
    {
        $billId = $this->createBill([$this->player($this->an), $this->player($this->binh)]);
        $this->markPayment($billId, $this->an);

        $this->travelTo('2026-11-02 09:00:00');
        $bill = $this->updateBill($billId, [$this->player($this->an), $this->player($this->binh)]);

        $this->assertPaidAtOriginalTime($billId, $this->an);
        $this->assertTrue($this->jsonPlayer($bill, $this->an)['is_paid']);
        $this->assertNotNull($this->jsonPlayer($bill, $this->an)['paid_at']);

        $this->assertFalse($this->row($billId, $this->binh)->is_paid);
        $this->assertNull($this->row($billId, $this->binh)->paid_at);
    }

    public function test_nguoi_moi_them_vao_la_chua_tt(): void
    {
        $billId = $this->createBill([$this->player($this->an), $this->player($this->binh)]);
        $this->markPayment($billId, $this->an);

        $this->updateBill($billId, [$this->player($this->an), $this->player($this->binh), $this->player($this->chi)]);

        $this->assertPaidAtOriginalTime($billId, $this->an);
        $this->assertFalse($this->row($billId, $this->chi)->is_paid);
        $this->assertNull($this->row($billId, $this->chi)->paid_at);
    }

    public function test_bo_nguoi_khoi_bill_thi_xoa_nguoi_do_nguoi_con_lai_giu_da_tt(): void
    {
        $billId = $this->createBill([$this->player($this->an), $this->player($this->binh)]);
        $this->markPayment($billId, $this->an);
        $this->markPayment($billId, $this->binh);

        $this->updateBill($billId, [$this->player($this->an)]);

        $this->assertNull($this->row($billId, $this->binh), 'Người bị bỏ khỏi bill phải bị xóa');
        $this->assertSame(1, BillPlayer::where('bill_id', $billId)->count());
        $this->assertPaidAtOriginalTime($billId, $this->an);
    }

    public function test_doi_muc_tinh_tien_san_va_nuoc_nguoi_da_tt_van_giu_da_tt_tien_tinh_lai_nhu_cu(): void
    {
        $sting = Menu::create(['name' => 'Sting', 'price' => 15000]);
        $billId = $this->createBill([$this->player($this->an), $this->player($this->binh)]);
        $this->markPayment($billId, $this->an);

        $bill = $this->updateBill($billId, [
            $this->player($this->an, 0.5, ['menus' => [['menu_id' => $sting->id, 'quantity' => 2]]]),
            $this->player($this->binh),
        ], ['court_total' => 300000]);

        // 300000 / (0.5 + 1) = 200000 mỗi suất: An 100000 + nước 30000, Bình 200000
        $an = $this->jsonPlayer($bill, $this->an);
        $this->assertSame(100000, $an['share_amount']);
        $this->assertSame(30000, $an['menu_extra_total']);
        $this->assertSame(130000, $an['total_amount']);
        $this->assertSame(200000, $this->jsonPlayer($bill, $this->binh)['total_amount']);

        // Mặc định an toàn: vẫn giữ Đã TT dù tiền thay đổi (chờ chủ dự án quyết)
        $this->assertPaidAtOriginalTime($billId, $this->an);
    }

    public function test_bo_danh_dau_tt_roi_sua_bill_van_la_chua_tt(): void
    {
        $billId = $this->createBill([$this->player($this->an), $this->player($this->binh)]);
        $this->markPayment($billId, $this->an);
        $this->markPayment($billId, $this->an, false);

        $this->updateBill($billId, [$this->player($this->an), $this->player($this->binh)]);

        $this->assertFalse($this->row($billId, $this->an)->is_paid);
        $this->assertNull($this->row($billId, $this->an)->paid_at);
    }

    public function test_bill_co_no_trong_bang_debts_van_giu_da_tt_va_tinh_no_nhu_cu(): void
    {
        $debt = Debt::create(['user_id' => $this->an->id, 'amount' => 50000, 'debt_date' => '2026-10-25']);
        $billId = $this->createBill([$this->player($this->an), $this->player($this->binh)]);
        $this->markPayment($billId, $this->an);

        $bill = $this->updateBill($billId, [$this->player($this->an), $this->player($this->binh)]);

        $an = $this->jsonPlayer($bill, $this->an);
        $this->assertSame(50000, $an['debt_amount']);
        $this->assertSame(100000 + 50000, $an['total_amount']);
        $this->assertPaidAtOriginalTime($billId, $this->an);
        $this->assertFalse($debt->fresh()->is_resolved, 'Sửa bill không được tự đổi bảng debts');
    }

    public function test_sua_bill_cu_da_tt_khong_hien_lai_thanh_no_cu_o_bill_sau(): void
    {
        $oldBillId = $this->createBill([$this->player($this->an), $this->player($this->binh)]);
        $this->markPayment($oldBillId, $this->an);
        $newBillId = $this->createBill([$this->player($this->an), $this->player($this->binh)], ['date' => '2026-11-08']);

        $this->updateBill($oldBillId, [$this->player($this->an), $this->player($this->binh)]);

        $newBill = $this->actingAs($this->thuQuy)->getJson("/api/bills/{$newBillId}")->assertStatus(200)->json();
        $an = $this->jsonPlayer($newBill, $this->an);
        $this->assertSame(0, (int) $an['debt_amount'], 'Bill cũ An đã TT không được thành nợ cũ sau khi sửa');
        $this->assertSame([], $an['debt_details']);
        // Bình chưa TT bill cũ: nợ cũ vẫn tính như trước
        $this->assertSame(100000, (int) $this->jsonPlayer($newBill, $this->binh)['debt_amount']);
    }

    public function test_sua_bill_con_giu_da_tt_va_giu_bill_chinh(): void
    {
        $parentId = $this->createBill([$this->player($this->an), $this->player($this->binh)]);
        $subId = $this->actingAs($this->thuQuy)
            ->postJson("/api/bills/{$parentId}/sub-bills", $this->payload([$this->player($this->an)], ['court_total' => 50000]))
            ->assertStatus(201)
            ->json('id');
        $this->markPayment($subId, $this->an);

        $sub = $this->updateBill($subId, [$this->player($this->an)], ['court_total' => 60000]);

        $this->assertSame($parentId, $sub['parent_bill_id']);
        $this->assertSame(60000, $this->jsonPlayer($sub, $this->an)['total_amount']);
        $this->assertPaidAtOriginalTime($subId, $this->an);
    }

    public function test_sua_bill_chinh_giu_da_tt_cua_bill_chinh_va_khong_dong_bill_con(): void
    {
        $parentId = $this->createBill([$this->player($this->an), $this->player($this->binh)]);
        $subId = $this->actingAs($this->thuQuy)
            ->postJson("/api/bills/{$parentId}/sub-bills", $this->payload([$this->player($this->an)], ['court_total' => 50000]))
            ->assertStatus(201)
            ->json('id');
        $this->markPayment($parentId, $this->an);
        $this->markPayment($subId, $this->an);
        $subRowId = $this->row($subId, $this->an)->id;

        $this->updateBill($parentId, [$this->player($this->an), $this->player($this->binh)]);

        $this->assertPaidAtOriginalTime($parentId, $this->an);
        $this->assertPaidAtOriginalTime($subId, $this->an);
        $this->assertSame($subRowId, $this->row($subId, $this->an)->id, 'Sửa bill chính không được tạo lại người chơi của bill con');
    }
}
