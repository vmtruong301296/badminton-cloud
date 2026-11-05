<?php

namespace Tests;

use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Str;

abstract class TestCase extends BaseTestCase
{
    /**
     * Người dùng có một vai trò mang đúng các quyền đưa vào (quyền chưa có trong bảng thì tạo).
     * Mảng rỗng = đăng nhập được nhưng không có vai trò nào.
     */
    protected function userWithPermissions(array $permissions, array $attributes = []): User
    {
        $user = User::create(array_merge([
            'name' => 'Người test',
            'email' => 'nguoi-test-'.Str::uuid().'@example.test',
            'password' => 'secret123',
        ], $attributes));

        if ($permissions === []) {
            return $user;
        }

        $role = Role::create([
            'name' => 'vai-tro-test-'.Str::uuid(),
            'display_name' => 'Vai trò test',
        ]);
        $role->permissions()->sync(array_map(
            fn (string $name) => Permission::firstOrCreate(['name' => $name], ['display_name' => $name])->id,
            $permissions,
        ));
        $user->roles()->attach($role);

        return $user;
    }

    /** Người dùng có vai trò admin đủ quyền như production (RolePermissionSeeder). */
    protected function adminUser(array $attributes = []): User
    {
        $this->seed(RolePermissionSeeder::class);

        $user = $this->userWithPermissions([], $attributes);
        $user->roles()->attach(Role::where('name', 'admin')->firstOrFail());

        return $user;
    }
}
