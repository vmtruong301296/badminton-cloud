<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BillPlayer extends Model
{
    protected $fillable = [
        'bill_id',
        'user_id',
        'ratio_value',
        'menu_extra_total',
        'extra_amount',
        'extra_note',
        'debt_amount',
        'debt_date',
        'share_amount',
        'total_amount',
        'is_paid',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'ratio_value' => 'decimal:3',
            'extra_amount' => 'integer',
            'debt_date' => 'date',
            'is_paid' => 'boolean',
            'paid_at' => 'datetime',
        ];
    }

    // Relationships
    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function billPlayerMenus(): HasMany
    {
        return $this->hasMany(BillPlayerMenu::class);
    }
}
