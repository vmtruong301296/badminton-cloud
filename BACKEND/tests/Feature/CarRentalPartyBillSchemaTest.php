<?php

namespace Tests\Feature;

use App\Models\CarRentalComparison;
use App\Models\PartyBill;
use App\Models\PartyBillExtra;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalPartyBillSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function bill(): PartyBill
    {
        return PartyBill::create([
            'date' => '2026-09-01',
            'name' => 'Tiệc test',
            'base_amount' => 0,
            'total_extra' => 0,
            'total_amount' => 0,
            'unit_price' => 0,
        ]);
    }

    private function comparison(?int $billId = null): CarRentalComparison
    {
        return CarRentalComparison::create([
            'name' => 'Chuyến Đà Lạt',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'break_even_km' => 181,
            'saving_amount' => 0,
            'total_shared_cost' => 0,
            'party_bill_id' => $billId,
            'selected_sort_order' => 1,
        ]);
    }

    public function test_luu_va_doc_lai_lien_ket(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);

        $fresh = CarRentalComparison::with('partyBill')->find($comparison->id);

        $this->assertSame($bill->id, $fresh->party_bill_id);
        $this->assertSame(1, $fresh->selected_sort_order);
        $this->assertSame('Tiệc test', $fresh->partyBill->name);
    }

    public function test_xoa_bill_tiec_thi_lan_thue_xe_ve_null(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);

        $bill->delete();

        $this->assertNull($comparison->fresh()->party_bill_id);
        $this->assertNotNull($comparison->fresh(), 'lần thuê xe không được bị xóa theo');
    }

    public function test_extra_mang_co_so_huu(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);

        $extra = $bill->extras()->create([
            'name' => 'Chuyến Đà Lạt',
            'amount' => 1880000,
            'car_rental_comparison_id' => $comparison->id,
        ]);

        $this->assertSame($comparison->id, $extra->fresh()->carRentalComparison->id);
        $this->assertCount(1, $bill->fresh()->carRentals);
    }

    public function test_extra_thu_cong_khong_co_co_so_huu(): void
    {
        $bill = $this->bill();
        $extra = $bill->extras()->create(['name' => 'Bánh', 'amount' => 100000]);

        $this->assertNull($extra->fresh()->car_rental_comparison_id);
    }

    public function test_xoa_lan_thue_xe_thi_dong_extra_bi_xoa_theo(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);

        $cuaThueXe = $bill->extras()->create([
            'name' => 'Chuyến Đà Lạt',
            'amount' => 1880000,
            'car_rental_comparison_id' => $comparison->id,
        ]);
        $thuCong = $bill->extras()->create(['name' => 'Bánh', 'amount' => 100000]);

        $comparison->delete();

        $this->assertNull(
            PartyBillExtra::find($cuaThueXe->id),
            'dòng do thuê xe sở hữu phải bị xóa theo'
        );
        $this->assertNotNull(
            PartyBillExtra::find($thuCong->id),
            'dòng người dùng tự nhập không được xóa lây'
        );
    }
}
