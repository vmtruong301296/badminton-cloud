<?php

namespace Tests\Feature;

use App\Models\CarRentalComparison;
use App\Models\CarRentalOption;
use App\Models\CarRentalSharedCost;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalControllerTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'name' => 'Người test',
            'email' => 'test@example.com',
            'password' => 'secret123', // cast 'hashed' của User tự băm
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Chuyến Đà Lạt',
            'date' => '2026-09-01',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'note' => null,
            'options' => [
                [
                    'name' => 'Xe xăng',
                    'sort_order' => 0,
                    'rental_per_day' => 500000,
                    'fuel_type' => 'petrol',
                    'consumption_per_100' => 7,
                    'fuel_unit_price' => 30000,
                    'extra_fixed_cost' => 0,
                    'km_limit_per_day' => null,
                    'over_km_fee' => 0,
                ],
                [
                    'name' => 'Xe điện',
                    'sort_order' => 1,
                    'rental_per_day' => 690000,
                    'fuel_type' => 'electric',
                    'consumption_per_100' => 0,
                    'fuel_unit_price' => 0,
                    'extra_fixed_cost' => 0,
                    'km_limit_per_day' => null,
                    'over_km_fee' => 0,
                ],
            ],
        ], $overrides);
    }

    public function test_chua_dang_nhap_bi_401(): void
    {
        $this->getJson('/api/car-rentals')->assertStatus(401);
    }

    public function test_tao_moi_va_backend_tu_tinh(): void
    {
        $response = $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload());

        $response->assertStatus(201)
            ->assertJsonPath('break_even_km', 181)
            ->assertJsonPath('saving_amount', 1300000)
            ->assertJsonPath('options.0.total_cost', 2680000)
            ->assertJsonPath('options.0.is_cheapest', false)
            ->assertJsonPath('options.1.total_cost', 1380000)
            ->assertJsonPath('options.1.is_cheapest', true);

        $this->assertSame(1, CarRentalComparison::count());
        $this->assertSame(2, CarRentalOption::count());
    }

    public function test_bo_qua_ket_qua_client_gui_len(): void
    {
        $payload = $this->payload();
        $payload['break_even_km'] = 99999;
        $payload['saving_amount'] = 1;
        $payload['options'][0]['total_cost'] = 1;
        $payload['options'][0]['cost_per_km'] = 1;
        $payload['options'][0]['is_cheapest'] = true;

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $payload)
            ->assertStatus(201)
            ->assertJsonPath('break_even_km', 181)
            ->assertJsonPath('saving_amount', 1300000)
            ->assertJsonPath('options.0.total_cost', 2680000)
            ->assertJsonPath('options.0.cost_per_km', 3350)
            ->assertJsonPath('options.0.is_cheapest', false);
    }

    public function test_gan_created_by_cho_nguoi_dang_dang_nhap(): void
    {
        $user = $this->user();

        $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('created_by', $user->id)
            ->assertJsonPath('creator.id', $user->id);
    }

    public function test_danh_sach_tra_ve_kem_options(): void
    {
        $user = $this->user();
        $this->actingAs($user)->postJson('/api/car-rentals', $this->payload());

        $this->actingAs($user)
            ->getJson('/api/car-rentals')
            ->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonPath('0.options.1.total_cost', 1380000);
    }

    public function test_xem_chi_tiet(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload())
            ->json('id');

        $this->actingAs($user)
            ->getJson("/api/car-rentals/{$id}")
            ->assertStatus(200)
            ->assertJsonPath('name', 'Chuyến Đà Lạt')
            ->assertJsonCount(2, 'options');
    }

    public function test_cap_nhat_thay_the_toan_bo_options(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload())
            ->json('id');

        $payload = $this->payload(['distance_km' => 400, 'name' => 'Chuyến Vũng Tàu']);
        $payload['options'][] = [
            'name' => 'Xe xăng nhà B',
            'sort_order' => 2,
            'rental_per_day' => 450000,
            'fuel_type' => 'petrol',
            'consumption_per_100' => 7,
            'fuel_unit_price' => 30000,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
        ];

        $this->actingAs($user)
            ->putJson("/api/car-rentals/{$id}", $payload)
            ->assertStatus(200)
            ->assertJsonPath('name', 'Chuyến Vũng Tàu')
            ->assertJsonPath('break_even_km', null)
            ->assertJsonCount(3, 'options');

        $this->assertSame(3, CarRentalOption::count(), 'options cũ phải bị xóa, không cộng dồn');
    }

    public function test_xoa(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload())
            ->json('id');

        $this->actingAs($user)
            ->deleteJson("/api/car-rentals/{$id}")
            ->assertStatus(200);

        $this->assertSame(0, CarRentalComparison::count());
        $this->assertSame(0, CarRentalOption::count());
    }

    public function test_it_hon_2_phuong_an_bi_422(): void
    {
        $payload = $this->payload();
        $payload['options'] = array_slice($payload['options'], 0, 1);

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('options');
    }

    public function test_fuel_type_khong_hop_le_bi_422(): void
    {
        $payload = $this->payload();
        $payload['options'][0]['fuel_type'] = 'diesel';

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('options.0.fuel_type');
    }

    public function test_so_ngay_nho_hon_1_bi_422(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload(['days' => 0]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('days');
    }

    // ----- Chi phí chung cả chuyến -----

    public function test_luu_chi_phi_chung_va_tinh_tong_chuyen(): void
    {
        $payload = $this->payload([
            'people_count' => 8,
            'shared_costs' => [
                ['name' => 'Gửi xe', 'amount' => 200000],
                ['name' => 'Trạm thu phí', 'amount' => 300000],
            ],
        ]);

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $payload)
            ->assertStatus(201)
            ->assertJsonPath('total_shared_cost', 500000)
            ->assertJsonCount(2, 'shared_costs')
            ->assertJsonPath('shared_costs.0.name', 'Gửi xe')
            ->assertJsonPath('options.0.total_cost', 2680000)
            ->assertJsonPath('options.0.trip_total_cost', 3180000)
            ->assertJsonPath('options.0.per_person_cost', 397500)
            ->assertJsonPath('options.1.trip_total_cost', 1880000)
            ->assertJsonPath('options.1.per_person_cost', 235000)
            // Chi phí chung không được đổi kết quả so sánh xe.
            ->assertJsonPath('saving_amount', 1300000)
            ->assertJsonPath('break_even_km', 181)
            ->assertJsonPath('options.1.is_cheapest', true);

        $this->assertSame(2, CarRentalSharedCost::count());
    }

    public function test_cap_nhat_thay_the_toan_bo_chi_phi_chung(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload([
                'shared_costs' => [
                    ['name' => 'Gửi xe', 'amount' => 200000],
                    ['name' => 'Trạm thu phí', 'amount' => 300000],
                ],
            ]))
            ->json('id');

        $this->actingAs($user)
            ->putJson("/api/car-rentals/{$id}", $this->payload([
                'shared_costs' => [['name' => 'Ăn uống', 'amount' => 1000000]],
            ]))
            ->assertStatus(200)
            ->assertJsonCount(1, 'shared_costs')
            ->assertJsonPath('shared_costs.0.name', 'Ăn uống')
            ->assertJsonPath('total_shared_cost', 1000000);

        $this->assertSame(1, CarRentalSharedCost::count(), 'chi phí chung cũ phải bị xóa, không cộng dồn');
    }

    public function test_xoa_comparison_thi_xoa_luon_chi_phi_chung(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload([
                'shared_costs' => [['name' => 'Gửi xe', 'amount' => 200000]],
            ]))
            ->json('id');

        $this->actingAs($user)->deleteJson("/api/car-rentals/{$id}")->assertStatus(200);

        $this->assertSame(0, CarRentalSharedCost::count());
    }

    public function test_khong_gui_chi_phi_chung_van_hop_le(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('total_shared_cost', 0)
            ->assertJsonCount(0, 'shared_costs')
            ->assertJsonPath('options.0.trip_total_cost', 2680000);
    }

    public function test_chi_phi_chung_am_bi_422(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload([
                'shared_costs' => [['name' => 'Gửi xe', 'amount' => -1]],
            ]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('shared_costs.0.amount');
    }
}
