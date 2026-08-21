<?php

namespace Tests\Feature;

use App\Models\PartyBill;
use App\Models\PartyBillExtra;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalPartyBillApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create(['name' => 'Người test', 'email' => 't@e.test', 'password' => 'secret123']);
    }

    private function bill(string $name = 'Tiệc test'): PartyBill
    {
        $bill = PartyBill::create([
            'date' => '2026-09-01', 'name' => $name, 'base_amount' => 1000000,
            'total_extra' => 0, 'total_amount' => 1000000, 'unit_price' => 0,
        ]);
        $bill->participants()->create([
            'name' => 'An', 'ratio_value' => 1, 'share_amount' => 0, 'total_amount' => 0,
            'paid_amount' => 0, 'food_amount' => 0, 'is_paid' => false,
        ]);

        return $bill->fresh(['participants']);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Chuyến Đà Lạt',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'options' => [
                [
                    'name' => 'Xe xăng', 'sort_order' => 0, 'rental_per_day' => 500000,
                    'fuel_type' => 'petrol', 'consumption_per_100' => 7, 'fuel_unit_price' => 30000,
                ],
                [
                    'name' => 'Xe điện', 'sort_order' => 1, 'rental_per_day' => 690000,
                    'fuel_type' => 'electric', 'consumption_per_100' => 0, 'fuel_unit_price' => 0,
                ],
            ],
        ], $overrides);
    }

    public function test_tao_lan_thue_xe_kem_gan_bill_tiec(): void
    {
        $bill = $this->bill();

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->assertStatus(201)
            ->assertJsonPath('party_bill_id', $bill->id)
            ->assertJsonPath('party_bill.name', 'Tiệc test');

        // Xe điện rẻ nhất: 1.380.000
        $this->assertSame(1380000, $bill->fresh()->total_extra);
        $this->assertSame(2380000, $bill->fresh()->total_amount);
    }

    public function test_khong_gan_bill_thi_khong_tao_extra(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('party_bill_id', null);

        $this->assertSame(0, PartyBillExtra::count());
    }

    public function test_sua_lan_thue_xe_thi_extra_cap_nhat(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->json('id');

        $this->actingAs($user)
            ->putJson("/api/car-rentals/{$id}", $this->payload([
                'party_bill_id' => $bill->id,
                'distance_km' => 400,
            ]))
            ->assertStatus(200);

        $this->assertSame(1380000, $bill->fresh()->total_extra, 'xe điện không đổi theo km');
        $this->assertSame(1, PartyBillExtra::count(), 'không được tạo dòng thứ hai');
    }

    public function test_doi_sang_bill_khac(): void
    {
        $billA = $this->bill('Tiệc A');
        $billB = $this->bill('Tiệc B');
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $billA->id]))
            ->json('id');

        $this->actingAs($user)
            ->putJson("/api/car-rentals/{$id}", $this->payload(['party_bill_id' => $billB->id]))
            ->assertStatus(200);

        $this->assertSame(0, $billA->fresh()->total_extra);
        $this->assertSame(1380000, $billB->fresh()->total_extra);
    }

    public function test_bo_gan(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->json('id');

        $this->actingAs($user)
            ->putJson("/api/car-rentals/{$id}", $this->payload(['party_bill_id' => null]))
            ->assertStatus(200);

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, $bill->fresh()->total_extra);
    }

    public function test_xoa_lan_thue_xe_thi_go_extra(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->json('id');

        $this->actingAs($user)->deleteJson("/api/car-rentals/{$id}")->assertStatus(200);

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, $bill->fresh()->total_extra);
    }

    public function test_bill_da_thanh_toan_het_thi_422_va_khong_doi_gi(): void
    {
        $bill = $this->bill();
        $bill->participants()->update(['is_paid' => true]);

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('party_bill_id');

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, \App\Models\CarRentalComparison::count(), 'phải rollback cả lần thuê xe');
    }

    public function test_party_bill_id_khong_ton_tai_bi_422(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => 99999]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('party_bill_id');
    }

    public function test_sua_bill_tiec_khong_xoa_dong_do_thue_xe_so_huu(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]));

        $this->actingAs($user)->putJson("/api/party-bills/{$bill->id}", [
            'date' => '2026-09-02',
            'name' => 'Tiệc đã sửa',
            'base_amount' => 2000000,
            'extras' => [['name' => 'Bánh', 'amount' => 100000]],
            'participants' => [['name' => 'An', 'ratio_value' => 1]],
        ])->assertStatus(200);

        $fresh = $bill->fresh(['extras']);
        $this->assertCount(2, $fresh->extras, 'dòng do thuê xe sở hữu phải còn');
        $this->assertSame(1480000, $fresh->total_extra, '1.380.000 xe + 100.000 bánh');
        $this->assertSame(3480000, $fresh->total_amount);
    }

    public function test_bo_qua_car_rental_comparison_id_client_bia_ra(): void
    {
        $bill = $this->bill();
        $user = $this->user();

        $this->actingAs($user)->putJson("/api/party-bills/{$bill->id}", [
            'date' => '2026-09-02',
            'name' => 'Tiệc',
            'base_amount' => 0,
            'extras' => [['name' => 'Giả mạo', 'amount' => 1, 'car_rental_comparison_id' => 123]],
            'participants' => [['name' => 'An', 'ratio_value' => 1]],
        ])->assertStatus(200);

        $this->assertSame(0, PartyBillExtra::whereNotNull('car_rental_comparison_id')->count());
    }

    public function test_xoa_bill_tiec_dang_duoc_gan(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->json('id');

        $this->actingAs($user)->deleteJson("/api/party-bills/{$bill->id}")->assertStatus(200);

        $this->assertNull(\App\Models\CarRentalComparison::find($id)->party_bill_id);
    }
}
