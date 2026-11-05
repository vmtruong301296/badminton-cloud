<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\LoginRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    /**
     * Login user (sai nhiều lần thì khóa tạm, xem LoginRequest)
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $user = $request->authenticate();

        Auth::login($user);
        $request->session()->regenerate();

        // Load user with roles and permissions
        $user->load('roles.permissions');

        return response()->json([
            'message' => 'Đăng nhập thành công',
            'user' => $user,
        ]);
    }

    /**
     * Get current authenticated user
     */
    public function me(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        // Load user with roles and permissions
        $user->load('roles.permissions');

        return response()->json($user);
    }

    /**
     * Logout user
     */
    public function logout(Request $request): JsonResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Đăng xuất thành công']);
    }
}
