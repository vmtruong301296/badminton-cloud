<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShuttleStockEntry extends Model
{
    protected $fillable = [
        'shuttle_type_id',
        'tubes',
        'balls',
        'total_balls',
        'entered_at',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'entered_at' => 'date',
        ];
    }

    public function shuttleType(): BelongsTo
    {
        return $this->belongsTo(ShuttleType::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
