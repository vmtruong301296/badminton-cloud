<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use InvalidArgumentException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Chặn request khi người đăng nhập không có ít nhất một trong các quyền của route.
 *
 * Khai báo trên route: `permission:bills.view|bills.create` (có một trong các quyền là qua),
 * thường viết qua RequirePermission::any('bills.view', 'bills.create').
 * Đặt sau middleware `auth`; thiếu người đăng nhập vẫn trả 401 như `auth`.
 */
class RequirePermission
{
    public const ALIAS = 'permission';

    public const DENIED_MESSAGE = 'Bạn không có quyền thực hiện thao tác này.';

    /** Chuỗi middleware cho route: qua khi có một trong các quyền đưa vào. */
    public static function any(string ...$permissions): string
    {
        if ($permissions === []) {
            throw new InvalidArgumentException('Route cần ít nhất một quyền.');
        }

        return self::ALIAS.':'.implode('|', $permissions);
    }

    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        $user = $request->user();

        if ($user === null) {
            throw new AuthenticationException;
        }

        $required = array_merge(...array_map(fn (string $group) => explode('|', $group), $permissions));

        if (! $user->hasAnyPermission($required)) {
            return response()->json(['message' => self::DENIED_MESSAGE], Response::HTTP_FORBIDDEN);
        }

        return $next($request);
    }
}
