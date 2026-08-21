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

    public function options(): HasMany
    {
        return $this->hasMany(CarRentalOption::class)->orderBy('sort_order');
    }
}
