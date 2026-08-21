<?php

namespace Tests\Unit;

use App\Models\PartyBill;
use App\Services\PartyBillRecalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PartyBillRecalculatorTest extends TestCase
{
    use RefreshDatabase;

    private PartyBillRecalculator $recalculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->recalculator = app(PartyBillRecalculator::class);
    }

    private function bill(int $baseAmount = 1000000): PartyBill
    {
        return PartyBill::create([
            'date' => '2026-09-01',
            'name' => 'Tiệc test',
            'base_amount' => $baseAmount,
            'total_extra' => 0,
            'total_amount' => 0,
            'unit_price' => 0,
        ]);
    }

    private function addParticipant(PartyBill $bill, string $name, float $ratio, array $extra = []): void
    {
        $bill->participants()->create(array_merge([
            'name' => $name,
            'ratio_value' => $ratio,
            'share_amount' => 0,
            'total_amount' => 0,
            'paid_amount' => 0,
            'food_amount' => 0,
            'is_paid' => false,
        ], $extra));
    }

    public function test_tinh_don_gia_va_share_voi_ti_le_le(): void
    {
        $bill = $this->bill(1000000);
        $bill->extras()->create(['name' => 'Bánh', 'amount' => 500000]);
        $this->addParticipant($bill, 'An', 1);
        $this->addParticipant($bill, 'Bình', 0.5);
        $this->addParticipant($bill, 'Chi', 1.5);

        $result = $this->recalculator->recalculate($bill);

        // 1.500.000 / 3 = 500.000
        $this->assertSame(500000, $result->total_extra);
        $this->assertSame(1500000, $result->total_amount);
        $this->assertSame(500000, $result->unit_price);

        $shares = $result->participants->pluck('share_amount', 'name')->all();
        $this->assertSame(500000, $shares['An']);
        $this->assertSame(250000, $shares['Bình']);
        $this->assertSame(750000, $shares['Chi']);
    }

    public function test_tong_ratio_bang_0_khong_chia_cho_0(): void
    {
        $bill = $this->bill();
        $this->addParticipant($bill, 'An', 0);

        $result = $this->recalculator->recalculate($bill);

        $this->assertSame(0, $result->unit_price);
        $this->assertSame(0, $result->participants->first()->share_amount);
    }

    public function test_giu_nguyen_da_tra_do_an_va_trang_thai(): void
    {
        $bill = $this->bill(1000000);
        $this->addParticipant($bill, 'An', 1, [
            'paid_amount' => 300000,
            'food_amount' => 50000,
            'is_paid' => true,
            'note' => 'ghi chú giữ nguyên',
        ]);

        $participant = $this->recalculator->recalculate($bill)->participants->first();

        $this->assertSame(300000, $participant->paid_amount);
        $this->assertSame(50000, $participant->food_amount);
        $this->assertTrue($participant->is_paid);
        $this->assertSame('ghi chú giữ nguyên', $participant->note);
        // share 1.000.000 + food 50.000 - paid 300.000
        $this->assertSame(750000, $participant->total_amount);
    }

    public function test_thanh_tien_am_duoc(): void
    {
        $bill = $this->bill(100000);
        $this->addParticipant($bill, 'An', 1, ['paid_amount' => 500000]);

        $this->assertSame(-400000, $this->recalculator->recalculate($bill)->participants->first()->total_amount);
    }

    public function test_cong_ca_dong_thu_cong_lan_dong_do_thue_xe_so_huu(): void
    {
        $bill = $this->bill(0);
        $bill->extras()->create(['name' => 'Thủ công', 'amount' => 100000]);
        // Dòng sở hữu được mô phỏng bằng cột car_rental_comparison_id (Task 3
        // tạo cột này). Ở Task 2 cột chưa có, nên test này chỉ kiểm rằng MỌI
        // dòng extras trong DB đều được cộng, bất kể đến từ đâu.
        $bill->extras()->create(['name' => 'Dòng thứ hai', 'amount' => 250000]);
        $this->addParticipant($bill, 'An', 1);

        $result = $this->recalculator->recalculate($bill);

        $this->assertSame(350000, $result->total_extra);
        $this->assertSame(350000, $result->unit_price);
    }

    public function test_is_fully_paid(): void
    {
        $bill = $this->bill();
        $this->addParticipant($bill, 'An', 1, ['is_paid' => true]);
        $this->addParticipant($bill, 'Bình', 1, ['is_paid' => false]);

        $this->assertFalse($this->recalculator->isFullyPaid($bill->fresh('participants')));

        $bill->participants()->update(['is_paid' => true]);

        $this->assertTrue($this->recalculator->isFullyPaid($bill->fresh('participants')));
    }

    public function test_giu_nguyen_lech_lam_tron_khong_bu_dong_cuoi(): void
    {
        // 1.000.000 / 3 người tỉ lệ 1 = đơn giá 333.333, ba dòng cộng lại
        // 999.999, lệch 1đ so với tổng. Đây là hành vi cố ý, không được bù.
        $bill = $this->bill(1000000);
        $this->addParticipant($bill, 'An', 1);
        $this->addParticipant($bill, 'Bình', 1);
        $this->addParticipant($bill, 'Chi', 1);

        $result = $this->recalculator->recalculate($bill);

        $this->assertSame(333333, $result->unit_price);
        $this->assertSame(1000000, $result->total_amount);
        $this->assertSame(999999, $result->participants->sum('share_amount'));
    }

    public function test_bill_khong_co_ai_tham_gia_thi_coi_nhu_da_tra_het(): void
    {
        // Collection::every() trên tập rỗng trả true. Giữ nguyên ngữ nghĩa này.
        $bill = $this->bill();

        $this->assertTrue($this->recalculator->isFullyPaid($bill->fresh('participants')));
    }
}
