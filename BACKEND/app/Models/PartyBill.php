<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PartyBill extends Model
{
    protected $fillable = [
        'date',
        'name',
        'note',
        'base_amount',
        'total_extra',
        'total_amount',
        'unit_price',
        'created_by',
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

    public function extras(): HasMany
    {
        return $this->hasMany(PartyBillExtra::class);
    }

    public function participants(): HasMany
    {
        return $this->hasMany(PartyBillParticipant::class);
    }

    public function carRentals(): HasMany
    {
        return $this->hasMany(CarRentalComparison::class, 'party_bill_id');
    }
}

