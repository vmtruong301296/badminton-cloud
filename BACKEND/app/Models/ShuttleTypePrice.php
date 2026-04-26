<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ShuttleTypePrice extends Model
{
    protected $fillable = [
        'shuttle_type_id',
        'effective_from',
        'price',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
        ];
    }

    public function shuttleType(): BelongsTo
    {
        return $this->belongsTo(ShuttleType::class);
    }
}
