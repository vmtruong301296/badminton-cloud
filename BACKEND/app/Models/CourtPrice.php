<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

/**
 * Một mốc giá sân: từ ngày effective_from, một sân 2 giờ giá `price`. Luôn còn ít nhất một mốc
 * (CourtPriceController chặn xoá mốc cuối) để bill con luôn có giá tính tiền sân theo giờ.
 */
class CourtPrice extends Model
{
    protected $fillable = [
        'effective_from',
        'price',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date:Y-m-d',
            'price' => 'integer',
        ];
    }

    /** Lịch giá, mốc mới nhất trước. */
    public function scopeLatestFirst(Builder $query): Builder
    {
        return $query->orderByDesc('effective_from');
    }
}
