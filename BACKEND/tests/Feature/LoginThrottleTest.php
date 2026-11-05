<?php

namespace Tests\Feature;

use App\Http\Requests\LoginRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Log;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * POST /api/login khóa tạm khi đăng nhập sai nhiều lần:
 * - cùng email + IP sai LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT lần → khóa email đó từ IP đó;
 * - một IP sai LoginRequest::MAX_ATTEMPTS_PER_IP lần (nhiều email) → khóa cả IP;
 * - khóa hết sau LoginRequest::DECAY_SECONDS tính từ lần sai đầu tiên.
 * Bị khóa thì trả 429 + Retry-After, kể cả khi lần đó nhập đúng mật khẩu.
 */
class LoginThrottleTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'mat-khau-dung';

    private const OTHER_IP = '10.0.0.2';

    private User $an;

    protected function setUp(): void
    {
        parent::setUp();

        $this->an = User::create(['name' => 'An', 'email' => 'an@example.com', 'password' => self::PASSWORD]);
    }

    public function test_dang_nhap_dung_khi_chua_sai_lan_nao(): void
    {
        $this->login('an@example.com', self::PASSWORD)->assertOk();

        $this->assertAuthenticatedAs($this->an);
    }

    public function test_sai_den_nguong_thi_lan_sau_bi_khoa_du_nhap_dung_mat_khau(): void
    {
        $this->failTimes('an@example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT);

        $response = $this->login('an@example.com', self::PASSWORD);

        $response->assertStatus(429)
            ->assertJsonPath('message', 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
        $retryAfter = (int) $response->headers->get('Retry-After');
        $this->assertGreaterThan(0, $retryAfter);
        $this->assertLessThanOrEqual(LoginRequest::DECAY_SECONDS, $retryAfter);
        $this->assertGuest();
    }

    public function test_sai_duoi_nguong_van_bao_sai_thong_tin_nhu_cu(): void
    {
        $this->failTimes('an@example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT - 1);

        $this->login('an@example.com', 'sai')
            ->assertStatus(422)
            ->assertJsonPath('errors.email.0', 'Thông tin đăng nhập không chính xác.');
    }

    public function test_thong_bao_khoa_tinh_theo_thoi_gian_con_lai(): void
    {
        $this->freezeTime();
        $this->failTimes('an@example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT);

        $this->travel(LoginRequest::DECAY_SECONDS - 30)->seconds();

        $this->login('an@example.com', self::PASSWORD)
            ->assertStatus(429)
            ->assertJsonPath('message', 'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 30 giây.');
    }

    public function test_het_thoi_gian_khoa_thi_dang_nhap_lai_duoc(): void
    {
        $this->failTimes('an@example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT);

        $this->travel(LoginRequest::DECAY_SECONDS + 1)->seconds();

        $this->login('an@example.com', self::PASSWORD)->assertOk();
    }

    public function test_dang_nhap_dung_thi_xoa_dem_sai_cua_email(): void
    {
        $this->failTimes('an@example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT - 1);
        $this->login('an@example.com', self::PASSWORD)->assertOk();

        $this->failTimes('an@example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT - 1);

        $this->login('an@example.com', self::PASSWORD)->assertOk();
    }

    public function test_khoa_email_khong_phan_biet_chu_hoa_chu_thuong(): void
    {
        $this->failTimes('AN@example.com', 2);
        $this->failTimes('An@Example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT - 2);

        $this->login('an@example.com', self::PASSWORD)->assertStatus(429);
    }

    public function test_khoa_email_nay_khong_chan_email_khac_cung_ip(): void
    {
        User::create(['name' => 'Bình', 'email' => 'binh@example.com', 'password' => self::PASSWORD]);
        $this->failTimes('an@example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT);

        $this->login('binh@example.com', self::PASSWORD)->assertOk();
    }

    public function test_khoa_email_tu_ip_nay_khong_chan_cung_email_tu_ip_khac(): void
    {
        $this->failTimes('an@example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT);

        $this->login('an@example.com', self::PASSWORD, self::OTHER_IP)->assertOk();
    }

    public function test_mot_ip_sai_nhieu_email_den_nguong_thi_khoa_ca_ip(): void
    {
        $this->failAcrossEmails(LoginRequest::MAX_ATTEMPTS_PER_IP);

        $this->login('an@example.com', self::PASSWORD)->assertStatus(429);
        $this->login('an@example.com', self::PASSWORD, self::OTHER_IP)->assertOk();
    }

    public function test_dang_nhap_dung_khong_xoa_dem_sai_cua_ip(): void
    {
        $this->failAcrossEmails(LoginRequest::MAX_ATTEMPTS_PER_IP - 1);
        $this->login('an@example.com', self::PASSWORD)->assertOk();
        $this->login('khac@example.com', 'sai')->assertStatus(422);

        $this->login('an@example.com', self::PASSWORD)->assertStatus(429);
    }

    public function test_ghi_log_mot_lan_khi_bat_dau_khoa(): void
    {
        Log::spy();

        $this->failTimes('an@example.com', LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT);
        $this->login('an@example.com', self::PASSWORD)->assertStatus(429);
        $this->login('an@example.com', self::PASSWORD)->assertStatus(429);

        Log::shouldHaveReceived('warning')
            ->once()
            ->withArgs(fn (string $message, array $context) => $context === [
                'email' => 'an@example.com',
                'ip' => '127.0.0.1',
                'scope' => 'account',
            ]);
    }

    public function test_thieu_email_van_bao_loi_nhap_lieu_va_khong_tinh_la_lan_sai(): void
    {
        foreach (range(1, LoginRequest::MAX_ATTEMPTS_PER_ACCOUNT) as $ignored) {
            $this->postJson('/api/login', ['password' => 'sai'])->assertStatus(422);
        }

        $this->login('an@example.com', self::PASSWORD)->assertOk();
    }

    private function login(string $email, string $password, string $ip = '127.0.0.1'): TestResponse
    {
        return $this->withServerVariables(['REMOTE_ADDR' => $ip])
            ->postJson('/api/login', ['email' => $email, 'password' => $password]);
    }

    private function failTimes(string $email, int $times): void
    {
        foreach (range(1, $times) as $ignored) {
            $this->login($email, 'sai')->assertStatus(422);
        }
    }

    /** Sai $times lần từ cùng một IP, mỗi email sai dưới ngưỡng khóa theo email. */
    private function failAcrossEmails(int $times): void
    {
        for ($i = 0; $i < $times; $i++) {
            $this->login("nguoi{$i}@example.com", 'sai')->assertStatus(422);
        }
    }
}
