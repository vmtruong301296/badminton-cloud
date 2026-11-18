<?php

namespace Tests\Feature;

use App\Models\PaymentAccount;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Tài khoản nhận tiền chọn sẵn khi xuất bill theo người đăng nhập (users.default_payment_account_id):
 * /api/me trả về để hộp "Gửi ảnh bill" chọn sẵn; xoá tài khoản thì về null (frontend chọn như cũ).
 */
class DefaultPaymentAccountTest extends TestCase
{
    use RefreshDatabase;

    private function account(string $bankName): PaymentAccount
    {
        return PaymentAccount::create([
            'bank_name' => $bankName,
            'account_number' => '0123',
            'account_holder_name' => $bankName,
        ]);
    }

    public function test_me_tra_ve_tai_khoan_mac_dinh_cua_nguoi_dang_nhap(): void
    {
        $account = $this->account('Minh Hiển');
        $user = User::create(['name' => 'Hiển', 'email' => 'hien@example.com', 'password' => 'x']);
        $user->forceFill(['default_payment_account_id' => $account->id])->save();

        $this->actingAs($user)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('default_payment_account_id', $account->id);
    }

    public function test_chua_dat_thi_me_tra_null(): void
    {
        $user = User::create(['name' => 'An', 'email' => 'an@example.com', 'password' => 'x']);

        $this->actingAs($user)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('default_payment_account_id', null);
    }

    public function test_xoa_tai_khoan_thi_mac_dinh_ve_null(): void
    {
        $account = $this->account('Văn Chung');
        $user = User::create(['name' => 'Chung', 'email' => 'chung@example.com', 'password' => 'x']);
        $user->forceFill(['default_payment_account_id' => $account->id])->save();

        $this->actingAs($this->adminUser())
            ->deleteJson("/api/payment-accounts/{$account->id}")
            ->assertOk();

        $this->assertNull($user->fresh()->default_payment_account_id);
    }
}
