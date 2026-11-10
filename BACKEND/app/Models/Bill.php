<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Bill extends Model
{
    /** Tổng tiền (sân + cầu) chia theo mức tính của từng người. */
    public const SPLIT_RATIO = 'ratio';

    /** Bill con chia theo từng trận (xem MatchBillCalculator). */
    public const SPLIT_MATCH = 'match';

    protected $fillable = [
        'date',
        'note',
        'court_total',
        'court_slots',
        'court_count',
        'created_by',
        'total_shuttle_price',
        'total_amount',
        'unit_price',
        'parent_bill_id',
        'split_mode',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
            'unit_price' => 'decimal:3',
            'court_slots' => 'array',
        ];
    }

    // Relationships
    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function billShuttles(): HasMany
    {
        return $this->hasMany(BillShuttle::class);
    }

    public function billPlayers(): HasMany
    {
        return $this->hasMany(BillPlayer::class);
    }

    /** Các trận, chỉ có ở bill chia theo trận. */
    public function matches(): HasMany
    {
        return $this->hasMany(BillMatch::class)->orderBy('position');
    }

    // Sub-bills relationship
    public function parentBill(): BelongsTo
    {
        return $this->belongsTo(Bill::class, 'parent_bill_id');
    }

    public function subBills(): HasMany
    {
        return $this->hasMany(Bill::class, 'parent_bill_id');
    }
}
