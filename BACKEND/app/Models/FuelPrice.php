<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FuelPrice extends Model
{
    protected $fillable = [
        'fuel_key',
        'price',
        'sources',
        'source_date',
        'fetched_at',
        'last_checked_at',
        'last_error',
        'updated_by',
    ];

    protected function casts(): array
    {
        return [
            'sources' => 'array',
            'source_date' => 'date',
            'fetched_at' => 'datetime',
            'last_checked_at' => 'datetime',
        ];
    }

    public function updatedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /** Giá do quản trị viên nhập tay, không phải cào được. */
    public function isManual(): bool
    {
        return $this->updated_by !== null;
    }

    /** Chưa cào được lần nào, hoặc lần cào gần nhất đã quá cũ. */
    public function isStale(): bool
    {
        if ($this->fetched_at === null) {
            return true;
        }

        return $this->fetched_at->diffInDays(now()) > config('fuel_prices.stale_after_days');
    }

    public function config(): array
    {
        return config("fuel_prices.types.{$this->fuel_key}", []);
    }

    public function label(): string
    {
        return $this->config()['label'] ?? $this->fuel_key;
    }
}
