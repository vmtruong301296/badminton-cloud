<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Một loại cầu dùng trong một trận (BillMatch): số quả, giá theo ngày bill. */
class BillMatchShuttle extends Model
{
    protected $fillable = [
        'bill_match_id',
        'shuttle_type_id',
        'quantity',
        'price_each',
        'subtotal',
    ];

    public function billMatch(): BelongsTo
    {
        return $this->belongsTo(BillMatch::class);
    }

    public function shuttleType(): BelongsTo
    {
        return $this->belongsTo(ShuttleType::class);
    }
}
