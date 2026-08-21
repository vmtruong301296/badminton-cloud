<?php

namespace Tests\Unit;

use App\Services\CarRentalCalculator;
use PHPUnit\Framework\TestCase;

class CarRentalCalculatorTest extends TestCase
{
    private CarRentalCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new CarRentalCalculator();
    }

    private function petrol(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Xe xăng',
            'sort_order' => 0,
            'rental_per_day' => 500000,
            'fuel_type' => 'petrol',
            'consumption_per_100' => 7,
            'fuel_unit_price' => 30000,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
        ], $overrides);
    }

    private function electric(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Xe điện',
            'sort_order' => 1,
            'rental_per_day' => 690000,
            'fuel_type' => 'electric',
            'consumption_per_100' => 0,
            'fuel_unit_price' => 0,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
        ], $overrides);
    }

    private function trip(array $options, array $overrides = []): array
    {
        return array_merge([
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'options' => $options,
        ], $overrides);
    }

    public function test_bai_toan_mau_800km_2_ngay(): void
    {
        $result = $this->calculator->calculate(
            $this->trip([$this->petrol(), $this->electric()])
        );

        [$petrol, $electric] = $result['options'];

        $this->assertSame(1000000, $petrol['rental_cost']);
        $this->assertSame(1680000, $petrol['fuel_cost']);
        $this->assertSame(0, $petrol['over_km_cost']);
        $this->assertSame(2680000, $petrol['total_cost']);
        $this->assertSame(3350, $petrol['cost_per_km']);
        $this->assertFalse($petrol['is_cheapest']);

        $this->assertSame(1380000, $electric['rental_cost']);
        $this->assertSame(0, $electric['fuel_cost']);
        $this->assertSame(1380000, $electric['total_cost']);
        $this->assertSame(1725, $electric['cost_per_km']);
        $this->assertTrue($electric['is_cheapest']);

        $this->assertSame(1300000, $result['saving_amount']);
        $this->assertSame(181, $result['break_even_km']);
    }

    public function test_xe_dien_sac_tra_phi(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(),
            $this->electric(['consumption_per_100' => 18, 'fuel_unit_price' => 3858]),
        ]));

        $this->assertSame(555552, $result['options'][1]['fuel_cost']);
        $this->assertSame(1935552, $result['options'][1]['total_cost']);
        $this->assertTrue($result['options'][1]['is_cheapest']);
        $this->assertSame(744448, $result['saving_amount']);
    }

    public function test_vuot_gioi_han_km_ap_cho_ca_hai_phuong_an(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(['km_limit_per_day' => 300, 'over_km_fee' => 4000]),
            $this->electric(['km_limit_per_day' => 300, 'over_km_fee' => 4000]),
        ]));

        $this->assertSame(800000, $result['options'][0]['over_km_cost']);
        $this->assertSame(800000, $result['options'][1]['over_km_cost']);
        $this->assertSame(3480000, $result['options'][0]['total_cost']);
        $this->assertSame(2180000, $result['options'][1]['total_cost']);
    }

    public function test_khong_vuot_khi_gioi_han_du_lon(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(['km_limit_per_day' => 500, 'over_km_fee' => 4000]),
            $this->electric(),
        ]));

        $this->assertSame(0, $result['options'][0]['over_km_cost']);
    }

    public function test_chi_phi_co_dinh_khac_cong_vao_tong(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(['extra_fixed_cost' => 200000]),
            $this->electric(),
        ]));

        $this->assertSame(2880000, $result['options'][0]['total_cost']);
    }

    public function test_fuel_type_none_bo_qua_tieu_hao(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(['fuel_type' => 'none']),
            $this->electric(),
        ]));

        $this->assertSame(0, $result['options'][0]['fuel_cost']);
        $this->assertSame(1000000, $result['options'][0]['total_cost']);
    }

    public function test_quang_duong_bang_0_khong_chia_cho_0(): void
    {
        $result = $this->calculator->calculate($this->trip(
            [$this->petrol(), $this->electric()],
            ['distance_km' => 0]
        ));

        $this->assertSame(0, $result['options'][0]['cost_per_km']);
        $this->assertSame(0, $result['options'][0]['fuel_cost']);
    }

    public function test_chia_dau_nguoi(): void
    {
        $result = $this->calculator->calculate($this->trip(
            [$this->petrol(), $this->electric()],
            ['people_count' => 8]
        ));

        $this->assertSame(335000, $result['options'][0]['per_person_cost']);
        $this->assertSame(172500, $result['options'][1]['per_person_cost']);
    }

    public function test_so_nguoi_bang_0_khong_chia_cho_0(): void
    {
        $result = $this->calculator->calculate($this->trip([$this->petrol(), $this->electric()]));

        $this->assertSame(0, $result['options'][0]['per_person_cost']);
    }

    public function test_ba_phuong_an_khong_co_diem_hoa_von(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(),
            $this->electric(),
            $this->petrol(['name' => 'Xe xăng nhà B', 'sort_order' => 2, 'rental_per_day' => 450000]),
        ]));

        $this->assertNull($result['break_even_km']);
        $this->assertTrue($result['options'][1]['is_cheapest']);
    }

    public function test_hai_phuong_an_cung_muc_tieu_hao_khong_co_nghiem(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(),
            $this->petrol(['name' => 'Xe xăng nhà B', 'sort_order' => 1, 'rental_per_day' => 450000]),
        ]));

        $this->assertNull($result['break_even_km']);
        $this->assertTrue($result['options'][1]['is_cheapest']);
    }

    public function test_diem_cat_am_tra_ve_null(): void
    {
        // Xe điện vừa rẻ tiền thuê vừa rẻ nhiên liệu: rẻ hơn ở mọi quãng đường.
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(),
            $this->electric(['rental_per_day' => 400000]),
        ]));

        $this->assertNull($result['break_even_km']);
    }

    public function test_hoa_tong_tien_thi_sort_order_nho_hon_thang(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->electric(['name' => 'Điện A', 'sort_order' => 0]),
            $this->electric(['name' => 'Điện B', 'sort_order' => 1]),
        ]));

        $this->assertTrue($result['options'][0]['is_cheapest']);
        $this->assertFalse($result['options'][1]['is_cheapest']);
        $this->assertSame(0, $result['saving_amount']);
    }

    // ----- Chi phí chung cả chuyến -----

    public function test_khong_co_chi_phi_chung_thi_trip_total_bang_total(): void
    {
        $result = $this->calculator->calculate($this->trip([$this->petrol(), $this->electric()]));

        $this->assertSame(0, $result['total_shared_cost']);
        $this->assertSame([], $result['shared_costs']);
        $this->assertSame(2680000, $result['options'][0]['trip_total_cost']);
        $this->assertSame(1380000, $result['options'][1]['trip_total_cost']);
    }

    public function test_chi_phi_chung_cong_vao_ca_hai_phuong_an(): void
    {
        $result = $this->calculator->calculate($this->trip(
            [$this->petrol(), $this->electric()],
            ['shared_costs' => [
                ['name' => 'Gửi xe', 'amount' => 200000],
                ['name' => 'Trạm thu phí', 'amount' => 300000],
            ]]
        ));

        $this->assertSame(500000, $result['total_shared_cost']);
        $this->assertCount(2, $result['shared_costs']);
        $this->assertSame('Gửi xe', $result['shared_costs'][0]['name']);
        $this->assertSame(0, $result['shared_costs'][0]['sort_order']);
        $this->assertSame(1, $result['shared_costs'][1]['sort_order']);

        // Chi phí xe giữ nguyên, chỉ tổng chuyến mới cộng thêm.
        $this->assertSame(2680000, $result['options'][0]['total_cost']);
        $this->assertSame(1380000, $result['options'][1]['total_cost']);
        $this->assertSame(3180000, $result['options'][0]['trip_total_cost']);
        $this->assertSame(1880000, $result['options'][1]['trip_total_cost']);
    }

    public function test_chi_phi_chung_khong_doi_phuong_an_re_nhat_va_diem_hoa_von(): void
    {
        $result = $this->calculator->calculate($this->trip(
            [$this->petrol(), $this->electric()],
            ['shared_costs' => [['name' => 'Gửi xe', 'amount' => 5000000]]]
        ));

        // Dù chi phí chung lớn hơn cả tiền xe, nó giống nhau cả hai bên nên
        // không được phép đổi người thắng, mức tiết kiệm, hay điểm hòa vốn.
        $this->assertTrue($result['options'][1]['is_cheapest']);
        $this->assertSame(1300000, $result['saving_amount']);
        $this->assertSame(181, $result['break_even_km']);
    }

    public function test_chia_dau_nguoi_tinh_tren_tong_chuyen(): void
    {
        $result = $this->calculator->calculate($this->trip(
            [$this->petrol(), $this->electric()],
            [
                'people_count' => 8,
                'shared_costs' => [['name' => 'Trạm thu phí', 'amount' => 400000]],
            ]
        ));

        // (2.680.000 + 400.000) / 8 = 385.000 ; (1.380.000 + 400.000) / 8 = 222.500
        $this->assertSame(385000, $result['options'][0]['per_person_cost']);
        $this->assertSame(222500, $result['options'][1]['per_person_cost']);
    }

    public function test_bo_qua_dong_chi_phi_chung_khong_co_ten(): void
    {
        $result = $this->calculator->calculate($this->trip(
            [$this->petrol(), $this->electric()],
            ['shared_costs' => [
                ['name' => 'Gửi xe', 'amount' => 200000],
                ['name' => '', 'amount' => 999000],
                ['name' => '   ', 'amount' => 111000],
            ]]
        ));

        $this->assertCount(1, $result['shared_costs']);
        $this->assertSame(200000, $result['total_shared_cost']);
    }
}
