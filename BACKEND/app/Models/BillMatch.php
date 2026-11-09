<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** Một trận của bill chia theo trận (Bill::SPLIT_MATCH). */
class BillMatch extends Model
{
    protected $fillable = [
        'bill_id',
        'position',
        'shuttle_type_id',
        'quantity',
        'price_each',
        'subtotal',
    ];

    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }

    public function shuttleType(): BelongsTo
    {
        return $this->belongsTo(ShuttleType::class);
    }

    /** Người đánh trận này, theo thứ tự đã chọn. */
    public function players(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'bill_match_players')
            ->orderBy('bill_match_players.id');
    }
}
