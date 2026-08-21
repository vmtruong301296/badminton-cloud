<?php

namespace Tests\Feature;

use App\Exceptions\PartyBillLockedException;
use App\Models\CarRentalComparison;
use App\Models\PartyBill;
use App\Models\PartyBillExtra;
use App\Services\CarRentalPartyBillLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalPartyBillLinkTest extends TestCase
{
    use RefreshDatabase;

    private CarRentalPartyBillLink $link;

    protected function setUp(): void
    {
        parent::setUp();
        $this->link = app(CarRentalPartyBillLink::class);
    }

    private function bill(string $name = 'Tiệc test', int $base = 1000000): PartyBill
    {
        $bill = PartyBill::create([
            'date' => '2026-09-01',
            'name' => $name,
            'base_amount' => $base,
            'total_extra' => 0,
            'total_amount' => $base,
            'unit_price' => 0,
        ]);

        $bill->participants()->create([
            'name' => 'An', 'ratio_value' => 1, 'share_amount' => 0,
            'total_amount' => 0, 'paid_amount' => 0, 'food_amount' => 0, 'is_paid' => false,
        ]);
        $bill->participants()->create([
            'name' => 'Bình', 'ratio_value' => 1, 'share_amount' => 0,
            'total_amount' => 0, 'paid_amount' => 0, 'food_amount' => 0, 'is_paid' => false,
        ]);

        return $bill->fresh(['participants']);
    }

    private function comparison(?int $billId, ?int $selected = null): CarRentalComparison
    {
        $comparison = CarRentalComparison::create([
            'name' => 'Chuyến Đà Lạt',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'break_even_km' => 181,
            'saving_amount' => 1300000,
            'total_shared_cost' => 500000,
            'party_bill_id' => $billId,
            'selected_sort_order' => $selected,
        ]);

        $comparison->options()->create([
            'name' => 'Xe xăng', 'sort_order' => 0, 'rental_per_day' => 500000,
            'fuel_type' => 'petrol', 'consumption_per_100' => 7, 'fuel_unit_price' => 30000,
            'rental_cost' => 1000000, 'fuel_cost' => 1680000, 'total_cost' => 2680000,
            'trip_total_cost' => 3180000, 'cost_per_km' => 3350, 'is_cheapest' => false,
        ]);
        $comparison->options()->create([
            'name' => 'Xe điện', 'sort_order' => 1, 'rental_per_day' => 690000,
            'fuel_type' => 'electric', 'consumption_per_100' => 0, 'fuel_unit_price' => 0,
            'rental_cost' => 1380000, 'fuel_cost' => 0, 'total_cost' => 1380000,
            'trip_total_cost' => 1880000, 'cost_per_km' => 1725, 'is_cheapest' => true,
        ]);

        return $comparison->fresh(['options']);
    }

    public function test_gan_tao_extra_va_tinh_lai_tien(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);

        $this->link->sync($comparison, null);

        $extra = PartyBillExtra::where('car_rental_comparison_id', $comparison->id)->first();
        $this->assertNotNull($extra);
        $this->assertSame('Chuyến Đà Lạt', $extra->name);
        $this->assertSame(1880000, $extra->amount, 'mặc định lấy phương án rẻ nhất');

        $bill = $bill->fresh(['participants']);
        $this->assertSame(1880000, $bill->total_extra);
        $this->assertSame(2880000, $bill->total_amount);
        $this->assertSame(1440000, $bill->unit_price);
        $this->assertSame(1440000, $bill->participants->first()->share_amount);
    }

    public function test_chon_phuong_an_cu_the(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id, 0); // xe xăng

        $this->link->sync($comparison, null);

        $this->assertSame(
            3180000,
            PartyBillExtra::where('car_rental_comparison_id', $comparison->id)->first()->amount
        );
    }

    public function test_selected_sort_order_tro_vao_phuong_an_da_bi_xoa_thi_lui_ve_re_nhat(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id, 99);

        $this->link->sync($comparison, null);

        $this->assertSame(
            1880000,
            PartyBillExtra::where('car_rental_comparison_id', $comparison->id)->first()->amount
        );
        $this->assertNull($comparison->fresh()->selected_sort_order, 'con trỏ chết phải bị xóa');
    }

    public function test_ten_rong_thi_dung_ten_du_phong(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);
        $comparison->update(['name' => null]);

        $this->link->sync($comparison->fresh(['options']), null);

        $this->assertSame(
            "Chuyến xe #{$comparison->id}",
            PartyBillExtra::where('car_rental_comparison_id', $comparison->id)->first()->name
        );
    }

    public function test_doi_sang_bill_khac_thi_tinh_lai_ca_hai(): void
    {
        $billA = $this->bill('Tiệc A');
        $billB = $this->bill('Tiệc B');
        $comparison = $this->comparison($billA->id);
        $this->link->sync($comparison, null);

        $comparison->update(['party_bill_id' => $billB->id]);
        $this->link->sync($comparison->fresh(['options']), $billA->id);

        $this->assertSame(0, $billA->fresh()->total_extra, 'bill cũ phải được gỡ và tính lại');
        $this->assertSame(1880000, $billB->fresh()->total_extra);
        $this->assertSame(1, PartyBillExtra::count());
    }

    public function test_bo_gan_thi_xoa_extra_va_tinh_lai(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);
        $this->link->sync($comparison, null);

        $comparison->update(['party_bill_id' => null]);
        $this->link->sync($comparison->fresh(['options']), $bill->id);

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, $bill->fresh()->total_extra);
        $this->assertSame(500000, $bill->fresh()->unit_price);
    }

    public function test_detach_go_dong_extra(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);
        $this->link->sync($comparison, null);

        $this->link->detach($comparison->fresh(['options']));

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, $bill->fresh()->total_extra);
    }

    public function test_hai_lan_thue_xe_cung_gan_mot_bill(): void
    {
        $bill = $this->bill();
        $first = $this->comparison($bill->id);
        $second = $this->comparison($bill->id);

        $this->link->sync($first, null);
        $this->link->sync($second, null);

        $this->assertSame(2, PartyBillExtra::count());
        $this->assertSame(3760000, $bill->fresh()->total_extra);
    }

    public function test_bill_dich_da_thanh_toan_het_thi_nem_loi(): void
    {
        $bill = $this->bill();
        $bill->participants()->update(['is_paid' => true]);
        $comparison = $this->comparison($bill->id);

        $this->expectException(PartyBillLockedException::class);
        $this->link->sync($comparison, null);
    }

    public function test_bill_da_thanh_toan_het_thi_khong_go_duoc(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);
        $this->link->sync($comparison, null);

        $bill->participants()->update(['is_paid' => true]);

        $this->expectException(PartyBillLockedException::class);
        $this->link->detach($comparison->fresh(['options']));
    }

    public function test_khong_gan_bill_nao_thi_khong_lam_gi(): void
    {
        $comparison = $this->comparison(null);

        $this->link->sync($comparison, null);

        $this->assertSame(0, PartyBillExtra::count());
    }

    public function test_chuyen_sang_bill_dang_khoa_thi_bill_cu_khong_bi_dong_vao(): void
    {
        $billA = $this->bill('Tiệc A');
        $billB = $this->bill('Tiệc B');
        $billB->participants()->update(['is_paid' => true]);

        $comparison = $this->comparison($billA->id);
        $this->link->sync($comparison, null);
        $this->assertSame(1880000, $billA->fresh()->total_extra);

        $comparison->update(['party_bill_id' => $billB->id]);

        try {
            $this->link->sync($comparison->fresh(['options']), $billA->id);
            $this->fail('phải ném PartyBillLockedException');
        } catch (PartyBillLockedException $e) {
            // đúng như mong đợi
        }

        // Mấu chốt: bill nguồn không được sửa dở dang rồi mới báo lỗi.
        $this->assertSame(1880000, $billA->fresh()->total_extra, 'bill nguồn phải còn nguyên');
        $this->assertSame(1, PartyBillExtra::where('party_bill_id', $billA->id)->count());
        $this->assertSame(0, PartyBillExtra::where('party_bill_id', $billB->id)->count());
    }

    public function test_chuyen_di_tu_bill_dang_khoa_thi_bill_dich_khong_nhan_gi(): void
    {
        $billA = $this->bill('Tiệc A');
        $billB = $this->bill('Tiệc B');

        $comparison = $this->comparison($billA->id);
        $this->link->sync($comparison, null);
        $billA->participants()->update(['is_paid' => true]);

        $comparison->update(['party_bill_id' => $billB->id]);

        try {
            $this->link->sync($comparison->fresh(['options']), $billA->id);
            $this->fail('phải ném PartyBillLockedException');
        } catch (PartyBillLockedException $e) {
            // đúng như mong đợi
        }

        $this->assertSame(0, $billB->fresh()->total_extra, 'bill đích không được nhận gì');
        $this->assertSame(0, PartyBillExtra::where('party_bill_id', $billB->id)->count());
        $this->assertSame(1, PartyBillExtra::where('party_bill_id', $billA->id)->count());
    }

    public function test_doi_phuong_an_tren_cung_mot_bill_thi_tien_doi_theo(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);
        $this->link->sync($comparison, null);
        $this->assertSame(1880000, $bill->fresh()->total_extra, 'mặc định lấy phương án rẻ nhất');

        // Đổi sang xe xăng (sort_order 0, trip_total_cost 3.180.000).
        $comparison->update(['selected_sort_order' => 0]);
        $this->link->sync($comparison->fresh(['options']), $bill->id);

        $this->assertSame(3180000, $bill->fresh()->total_extra);
        $this->assertSame(1, PartyBillExtra::count(), 'phải cập nhật dòng cũ, không tạo dòng thứ hai');
        $this->assertSame('Chuyến Đà Lạt', PartyBillExtra::first()->name);
    }
}
