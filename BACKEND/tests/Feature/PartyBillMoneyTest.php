<?php

namespace Tests\Feature;

use App\Models\PartyBill;
use App\Models\PartyBillParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * KHÓA HÀNH VI TIỀN CỦA BILL TIỆC.
 *
 * File này mô tả hành vi ĐANG CHẠY THẬT trước khi tách PartyBillRecalculator.
 * Nếu nó đỏ sau refactor thì refactor sai, KHÔNG được sửa kỳ vọng ở đây.
 */
class PartyBillMoneyTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'name' => 'Người test',
            'email' => 'test@example.com',
            'password' => 'secret123',
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'date' => '2026-09-01',
            'name' => 'Tiệc test',
            'note' => null,
            'base_amount' => 1000000,
            'extras' => [
                ['name' => 'Bánh', 'amount' => 200000],
                ['name' => 'Nước', 'amount' => 300000],
            ],
            'participants' => [
                ['name' => 'An', 'ratio_value' => 1],
                ['name' => 'Bình', 'ratio_value' => 1],
                ['name' => 'Chi', 'ratio_value' => 0.5],
            ],
        ], $overrides);
    }

    public function test_tao_bill_tinh_dung_tong_va_don_gia(): void
    {
        $response = $this->actingAs($this->user())
            ->postJson('/api/party-bills', $this->payload());

        // base 1.000.000 + extras 500.000 = 1.500.000
        // sum ratio = 2.5  =>  unit_price = 600.000
        $response->assertStatus(201)
            ->assertJsonPath('total_extra', 500000)
            ->assertJsonPath('total_amount', 1500000)
            ->assertJsonPath('unit_price', 600000);
    }

    public function test_tao_bill_tinh_dung_share_tung_nguoi(): void
    {
        $id = $this->actingAs($this->user())
            ->postJson('/api/party-bills', $this->payload())
            ->json('id');

        $bill = PartyBill::with('participants')->find($id);
        $shares = $bill->participants->pluck('share_amount', 'name')->all();

        $this->assertSame(600000, $shares['An']);
        $this->assertSame(600000, $shares['Bình']);
        $this->assertSame(300000, $shares['Chi']);
    }

    public function test_thanh_tien_bang_share_cong_do_an_tru_da_tra(): void
    {
        $payload = $this->payload([
            'participants' => [
                ['name' => 'An', 'ratio_value' => 1, 'food_amount' => 50000, 'paid_amount' => 0],
                ['name' => 'Bình', 'ratio_value' => 1, 'food_amount' => 0, 'paid_amount' => 2000000],
            ],
        ]);

        $id = $this->actingAs($this->user())->postJson('/api/party-bills', $payload)->json('id');
        $bill = PartyBill::with('participants')->find($id);

        // sum ratio = 2 => unit_price = 750.000
        $an = $bill->participants->firstWhere('name', 'An');
        $binh = $bill->participants->firstWhere('name', 'Bình');

        $this->assertSame(800000, $an->total_amount);            // 750k + 50k - 0
        $this->assertSame(-1250000, $binh->total_amount);        // 750k + 0 - 2.000k, ÂM là đúng
    }

    public function test_khong_co_extras_thi_total_extra_bang_0(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/party-bills', $this->payload(['extras' => []]))
            ->assertStatus(201)
            ->assertJsonPath('total_extra', 0)
            ->assertJsonPath('total_amount', 1000000);
    }

    public function test_tong_ratio_bang_0_thi_don_gia_bang_0(): void
    {
        $payload = $this->payload([
            'participants' => [
                ['name' => 'An', 'ratio_value' => 0],
                ['name' => 'Bình', 'ratio_value' => 0],
            ],
        ]);

        $this->actingAs($this->user())
            ->postJson('/api/party-bills', $payload)
            ->assertStatus(201)
            ->assertJsonPath('unit_price', 0);
    }

    public function test_sua_bill_tinh_lai_toan_bo(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)->postJson('/api/party-bills', $this->payload())->json('id');

        $this->actingAs($user)
            ->putJson("/api/party-bills/{$id}", $this->payload([
                'base_amount' => 2000000,
                'extras' => [['name' => 'Bánh', 'amount' => 500000]],
            ]))
            ->assertStatus(200)
            ->assertJsonPath('total_extra', 500000)
            ->assertJsonPath('total_amount', 2500000)
            ->assertJsonPath('unit_price', 1000000);
    }

    public function test_sua_bill_thay_the_toan_bo_extras(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)->postJson('/api/party-bills', $this->payload())->json('id');

        $response = $this->actingAs($user)->putJson("/api/party-bills/{$id}", $this->payload([
            'extras' => [['name' => 'Chỉ còn một', 'amount' => 100000]],
        ]));

        $response->assertStatus(200)->assertJsonCount(1, 'extras');
        $this->assertSame('Chỉ còn một', $response->json('extras.0.name'));
    }

    public function test_bill_da_thanh_toan_het_thi_khong_sua_duoc(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)->postJson('/api/party-bills', $this->payload())->json('id');

        PartyBillParticipant::where('party_bill_id', $id)->update(['is_paid' => true]);

        $this->actingAs($user)
            ->putJson("/api/party-bills/{$id}", $this->payload(['base_amount' => 999]))
            ->assertStatus(403);
    }

    public function test_con_mot_nguoi_chua_tra_thi_van_sua_duoc(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)->postJson('/api/party-bills', $this->payload())->json('id');

        PartyBillParticipant::where('party_bill_id', $id)->update(['is_paid' => true]);
        PartyBillParticipant::where('party_bill_id', $id)->limit(1)->update(['is_paid' => false]);

        $this->actingAs($user)
            ->putJson("/api/party-bills/{$id}", $this->payload(['base_amount' => 2000000]))
            ->assertStatus(200);
    }
}
