<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarRentalOption extends Model
{
    protected $fillable = [
        'car_rental_comparison_id',
        'name',
        'sort_order',
        'rental_per_day',
        'fuel_type',
        'consumption_per_100',
        'fuel_unit_price',
        'extra_fixed_cost',
        'km_limit_per_day',
        'over_km_fee',
        'rental_cost',
        'fuel_cost',
        'over_km_cost',
        'total_cost',
        'trip_total_cost',
        'cost_per_km',
        'per_person_cost',
        'is_cheapest',
    ];

    protected function casts(): array
    {
        return [
            'consumption_per_100' => 'float',
            'is_cheapest' => 'boolean',
        ];
    }

    public function comparison(): BelongsTo
    {
        return $this->belongsTo(CarRentalComparison::class, 'car_rental_comparison_id');
    }
}
