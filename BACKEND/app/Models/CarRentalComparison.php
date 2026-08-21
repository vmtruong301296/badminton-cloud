<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CarRentalComparison extends Model
{
    protected $fillable = [
        'name',
        'date',
        'days',
        'distance_km',
        'people_count',
        'note',
        'break_even_km',
        'saving_amount',
        'total_shared_cost',
        'created_by',
        'party_bill_id',
        'selected_sort_order',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function partyBill(): BelongsTo
    {
        return $this->belongsTo(PartyBill::class, 'party_bill_id');
    }

    public function options(): HasMany
    {
        return $this->hasMany(CarRentalOption::class)->orderBy('sort_order');
    }

    public function sharedCosts(): HasMany
    {
        return $this->hasMany(CarRentalSharedCost::class)->orderBy('sort_order');
    }
}
