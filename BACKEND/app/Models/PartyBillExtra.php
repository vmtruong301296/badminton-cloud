<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartyBillExtra extends Model
{
    protected $fillable = [
        'party_bill_id',
        'name',
        'amount',
        'car_rental_comparison_id',
    ];

    public function partyBill(): BelongsTo
    {
        return $this->belongsTo(PartyBill::class);
    }

    public function carRentalComparison(): BelongsTo
    {
        return $this->belongsTo(CarRentalComparison::class, 'car_rental_comparison_id');
    }
}

