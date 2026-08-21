<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarRentalSharedCost extends Model
{
    protected $fillable = [
        'car_rental_comparison_id',
        'name',
        'amount',
        'sort_order',
    ];

    public function comparison(): BelongsTo
    {
        return $this->belongsTo(CarRentalComparison::class, 'car_rental_comparison_id');
    }
}
