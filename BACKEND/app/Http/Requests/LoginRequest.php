<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Đăng nhập + khóa tạm khi sai nhiều lần (test: tests/Feature/LoginThrottleTest.php).
 * Chỉ lần sai mật khẩu mới bị đếm; khóa hết sau DECAY_SECONDS tính từ lần sai đầu tiên.
 */
class LoginRequest extends FormRequest
{
    /** Số lần sai cho cùng một email từ cùng một IP. */
    public const MAX_ATTEMPTS_PER_ACCOUNT = 5;

    /** Số lần sai từ một IP, cộng mọi email (chặn dò mật khẩu nhiều tài khoản). Rộng cho cả nhóm chung wifi. */
    public const MAX_ATTEMPTS_PER_IP = 30;

    public const DECAY_SECONDS = 15 * 60;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email' => 'required|email',
            'password' => 'required|string',
        ];
    }

    /**
     * @throws ThrottleRequestsException đang bị khóa (429)
     * @throws ValidationException sai email / mật khẩu (422)
     */
    public function authenticate(): User
    {
        $this->ensureIsNotLockedOut();

        $user = User::where('email', $this->input('email'))->first();

        if (! $user || ! Hash::check($this->input('password'), $user->password)) {
            $this->recordFailure();

            throw ValidationException::withMessages([
                'email' => ['Thông tin đăng nhập không chính xác.'],
            ]);
        }

        // Không xóa đếm theo IP: đăng nhập đúng tài khoản của mình không được mở khóa cho việc dò tài khoản khác.
        RateLimiter::clear($this->accountKey());

        return $user;
    }

    private function ensureIsNotLockedOut(): void
    {
        $limits = [
            $this->accountKey() => self::MAX_ATTEMPTS_PER_ACCOUNT,
            $this->ipKey() => self::MAX_ATTEMPTS_PER_IP,
        ];

        $seconds = 0;
        foreach ($limits as $key => $maxAttempts) {
            if (RateLimiter::tooManyAttempts($key, $maxAttempts)) {
                $seconds = max($seconds, RateLimiter::availableIn($key));
            }
        }

        if ($seconds > 0) {
            throw new ThrottleRequestsException(
                'Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau '.$this->waitText($seconds).'.',
                null,
                ['Retry-After' => $seconds],
            );
        }
    }

    private function recordFailure(): void
    {
        if (RateLimiter::hit($this->accountKey(), self::DECAY_SECONDS) === self::MAX_ATTEMPTS_PER_ACCOUNT) {
            $this->logLockout('account');
        }

        if (RateLimiter::hit($this->ipKey(), self::DECAY_SECONDS) === self::MAX_ATTEMPTS_PER_IP) {
            $this->logLockout('ip');
        }
    }

    private function logLockout(string $scope): void
    {
        Log::warning('Khóa đăng nhập tạm thời vì sai nhiều lần', [
            'email' => $this->input('email'),
            'ip' => $this->ip(),
            'scope' => $scope,
        ]);
    }

    private function waitText(int $seconds): string
    {
        return $seconds < 60 ? $seconds.' giây' : (int) ceil($seconds / 60).' phút';
    }

    private function accountKey(): string
    {
        return 'login:account:'.Str::transliterate(Str::lower((string) $this->input('email'))).'|'.$this->ip();
    }

    private function ipKey(): string
    {
        return 'login:ip:'.$this->ip();
    }
}
