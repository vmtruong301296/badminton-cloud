<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Một trận của bill chia theo trận (Bill::SPLIT_MATCH). subtotal là tổng tiền
 * cầu của trận (cộng các dòng ở shuttles).
 */
class BillMatch extends Model
{
    protected $fillable = [
        'bill_id',
        'position',
        'subtotal',
    ];

    public function bill(): BelongsTo
    {
        return $this->belongsTo(Bill::class);
    }

    /** Các loại cầu dùng trong trận, theo thứ tự đã nhập. */
    public function shuttles(): HasMany
    {
        return $this->hasMany(BillMatchShuttle::class)->orderBy('id');
    }

    /** Người đánh trận này, theo thứ tự đã chọn. */
    public function players(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'bill_match_players')
            ->orderBy('bill_match_players.id');
    }
}
