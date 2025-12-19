<?php

namespace Database\Seeders;

use App\Models\Menu;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class MenuSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $menus = [
            [
                'name' => 'Trà đá',
                'price' => 5000,
            ],
            [
                'name' => 'Giữ xe',
                'price' => 2000,
            ],
            [
                'name' => 'Nước Revive',
                'price' => 12000,
            ],
            [
                'name' => 'Nước Ô long',
                'price' => 12000,
            ],
            [
                'name' => 'Sting',
                'price' => 15000,
            ],
            [
                'name' => 'Trừ tiền revive',
                'price' => -10000,
            ],
        ];

        foreach ($menus as $menu) {
            Menu::firstOrCreate(
                ['name' => $menu['name']],
                $menu
            );
        }
    }
}
