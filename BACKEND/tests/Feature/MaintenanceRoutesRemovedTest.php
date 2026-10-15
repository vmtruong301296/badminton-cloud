<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Hai route bảo trì đã gỡ: ai đăng nhập được cũng gọi được migrate / xoá cache trên máy chủ thật.
 * Migrate và dựng cache nay chạy lúc khởi động (docker/entrypoint.sh) hoặc deploy.sh trên VPS.
 */
class MaintenanceRoutesRemovedTest extends TestCase
{
    use RefreshDatabase;

    public function test_route_migrate_khong_con(): void
    {
        $user = User::create(['name' => 'Người test', 'email' => 'test@example.com', 'password' => 'secret123']);

        $this->actingAs($user)->getJson('/api/run-migrate-secret-123')->assertNotFound();
    }

    public function test_route_xoa_cache_khong_con(): void
    {
        $user = User::create(['name' => 'Người test', 'email' => 'test@example.com', 'password' => 'secret123']);

        $this->actingAs($user)->getJson('/api/clear/cache/123')->assertNotFound();
    }
}
