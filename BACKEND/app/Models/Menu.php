<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Menu extends Model
{
    protected $fillable = [
        'name',
        'price',
        'is_active',
    ];

    // Món tạo mới mặc định bật (khớp default của cột) để response trả ngay is_active.
    protected $attributes = [
        'is_active' => true,
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    // Relationships
    public function billPlayerMenus()
    {
        return $this->hasMany(BillPlayerMenu::class);
    }
}
