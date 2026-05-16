<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolePermissionSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Create Permissions
        $permissions = [
            // Bills permissions
            ['name' => 'bills.view', 'display_name' => 'Xem bills', 'group' => 'bills'],
            ['name' => 'bills.create', 'display_name' => 'Tạo bill', 'group' => 'bills'],
            ['name' => 'bills.update', 'display_name' => 'Sửa bill', 'group' => 'bills'],
            ['name' => 'bills.delete', 'display_name' => 'Xóa bill', 'group' => 'bills'],
            ['name' => 'bills.mark_payment', 'display_name' => 'Đánh dấu thanh toán', 'group' => 'bills'],
            
            // Users/Players permissions
            ['name' => 'users.view', 'display_name' => 'Xem người chơi', 'group' => 'users'],
            ['name' => 'users.create', 'display_name' => 'Tạo người chơi', 'group' => 'users'],
            ['name' => 'users.update', 'display_name' => 'Sửa người chơi', 'group' => 'users'],
            ['name' => 'users.delete', 'display_name' => 'Xóa người chơi', 'group' => 'users'],
            
            // Roles & Permissions
            ['name' => 'roles.view', 'display_name' => 'Xem quyền', 'group' => 'roles'],
            ['name' => 'roles.create', 'display_name' => 'Tạo quyền', 'group' => 'roles'],
            ['name' => 'roles.update', 'display_name' => 'Sửa quyền', 'group' => 'roles'],
            ['name' => 'roles.delete', 'display_name' => 'Xóa quyền', 'group' => 'roles'],
            ['name' => 'roles.assign', 'display_name' => 'Gán quyền cho người dùng', 'group' => 'roles'],
            
            // Menus
            ['name' => 'menus.view', 'display_name' => 'Xem menu', 'group' => 'menus'],
            ['name' => 'menus.create', 'display_name' => 'Tạo menu', 'group' => 'menus'],
            ['name' => 'menus.update', 'display_name' => 'Sửa menu', 'group' => 'menus'],
            ['name' => 'menus.delete', 'display_name' => 'Xóa menu', 'group' => 'menus'],
            
            // Shuttles
            ['name' => 'shuttles.view', 'display_name' => 'Xem loại cầu', 'group' => 'shuttles'],
            ['name' => 'shuttles.create', 'display_name' => 'Tạo loại cầu', 'group' => 'shuttles'],
            ['name' => 'shuttles.update', 'display_name' => 'Sửa loại cầu', 'group' => 'shuttles'],
            ['name' => 'shuttles.delete', 'display_name' => 'Xóa loại cầu', 'group' => 'shuttles'],
            
            // Ratios
            ['name' => 'ratios.view', 'display_name' => 'Xem mức tính', 'group' => 'ratios'],
            ['name' => 'ratios.create', 'display_name' => 'Tạo mức tính', 'group' => 'ratios'],
            ['name' => 'ratios.update', 'display_name' => 'Sửa mức tính', 'group' => 'ratios'],
            ['name' => 'ratios.delete', 'display_name' => 'Xóa mức tính', 'group' => 'ratios'],
            
            // Payment Accounts
            ['name' => 'payment_accounts.view', 'display_name' => 'Xem tài khoản thanh toán', 'group' => 'payment_accounts'],
            ['name' => 'payment_accounts.create', 'display_name' => 'Tạo tài khoản thanh toán', 'group' => 'payment_accounts'],
            ['name' => 'payment_accounts.update', 'display_name' => 'Sửa tài khoản thanh toán', 'group' => 'payment_accounts'],
            ['name' => 'payment_accounts.delete', 'display_name' => 'Xóa tài khoản thanh toán', 'group' => 'payment_accounts'],

            // Party Bills
            ['name' => 'party_bills.view', 'display_name' => 'Xem bill tiệc', 'group' => 'party_bills'],
            ['name' => 'party_bills.create', 'display_name' => 'Tạo bill tiệc', 'group' => 'party_bills'],
            ['name' => 'party_bills.update', 'display_name' => 'Sửa bill tiệc', 'group' => 'party_bills'],
            ['name' => 'party_bills.delete', 'display_name' => 'Xóa bill tiệc', 'group' => 'party_bills'],

            // Tournament Brackets
            ['name' => 'tournament_brackets.view', 'display_name' => 'Xem xếp bảng', 'group' => 'tournament_brackets'],
            ['name' => 'tournament_brackets.create_list', 'display_name' => 'Tạo danh sách VĐV (xếp bảng)', 'group' => 'tournament_brackets'],
            ['name' => 'tournament_brackets.organize', 'display_name' => 'Xếp bảng thi đấu', 'group' => 'tournament_brackets'],
            ['name' => 'tournament_brackets.delete', 'display_name' => 'Xóa bảng thi đấu', 'group' => 'tournament_brackets'],
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(
                ['name' => $permission['name']],
                $permission
            );
        }

        // Create Roles
        $adminRole = Role::firstOrCreate(
            ['name' => 'admin'],
            [
                'display_name' => 'Admin',
                'description' => 'Quyền quản trị viên - có tất cả quyền',
            ]
        );

        $schedulerRole = Role::firstOrCreate(
            ['name' => 'scheduler'],
            [
                'display_name' => 'Sắp lịch thi đấu',
                'description' => 'Quyền sắp lịch thi đấu - có thể tạo và quản lý bills',
            ]
        );

        // New roles for viewing / scheduling tournament brackets
        $tournamentViewerRole = Role::firstOrCreate(
            ['name' => 'tournament_viewer'],
            [
                'display_name' => 'Xem bảng thi đấu',
                'description' => 'Chỉ được xem bảng thi đấu',
            ]
        );

        $tournamentSchedulerRole = Role::firstOrCreate(
            ['name' => 'tournament_scheduler'],
            [
                'display_name' => 'Xếp bảng thi đấu',
                'description' => 'Được tạo/xếp/xóa bảng thi đấu',
            ]
        );

        // Assign all permissions to admin
        $adminRole->permissions()->sync(Permission::pluck('id'));

        // Assign bills and related permissions to scheduler
        $schedulerPermissions = Permission::whereIn('name', [
            'bills.view',
            'bills.create',
            'bills.update',
            'bills.mark_payment',
            'users.view',
            'menus.view',
            'shuttles.view',
            'ratios.view',
            'party_bills.view',
            'party_bills.create',
            'party_bills.update',
            'tournament_brackets.view',
            'tournament_brackets.create_list',
            'tournament_brackets.organize',
        ])->pluck('id');
        $schedulerRole->permissions()->sync($schedulerPermissions);

        // Assign tournament view-only permissions
        $tournamentViewerPermissions = Permission::whereIn('name', [
            'tournament_brackets.view',
        ])->pluck('id');
        $tournamentViewerRole->permissions()->sync($tournamentViewerPermissions);

        // Assign tournament schedule permissions (view/create/delete)
        $tournamentSchedulerPermissions = Permission::whereIn('name', [
            'tournament_brackets.view',
            'tournament_brackets.create_list',
            'tournament_brackets.organize',
            'tournament_brackets.delete',
        ])->pluck('id');
        $tournamentSchedulerRole->permissions()->sync($tournamentSchedulerPermissions);
    }
}
