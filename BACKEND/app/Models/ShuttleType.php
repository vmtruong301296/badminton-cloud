<?php

namespace App\Models;

use Carbon\CarbonInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class ShuttleType extends Model
{
    protected $fillable = [
        'name',
        'price',
        'stock_quantity',
    ];

    protected static function booted(): void
    {
        static::created(function (ShuttleType $shuttleType) {
            ShuttleTypePrice::firstOrCreate(
                [
                    'shuttle_type_id' => $shuttleType->id,
                    'effective_from' => '1970-01-01',
                ],
                ['price' => (int) $shuttleType->price]
            );
        });
    }

    /**
     * Giá áp dụng cho một ngày cụ thể (theo mốc effective_from mới nhất không sau ngày đó).
     */
    public function priceForDate(CarbonInterface|string $date): int
    {
        $d = \Carbon\Carbon::parse($date)->toDateString();
        $row = $this->prices()
            ->where('effective_from', '<=', $d)
            ->orderByDesc('effective_from')
            ->first();

        return (int) ($row?->price ?? $this->price);
    }

    public function syncListedPriceFromSchedule(): void
    {
        $this->price = $this->priceForDate(now());
        $this->saveQuietly();
    }

    /**
     * Gắn thuộc tính price_for_bill cho từng loại (tránh N+1 khi có nhiều loại).
     *
     * @param  Collection<int, ShuttleType>|array<int, ShuttleType>  $shuttleTypes
     */
    public static function attachPriceForBill(Collection|array $shuttleTypes, CarbonInterface|string $date): void
    {
        $collection = $shuttleTypes instanceof Collection ? $shuttleTypes : collect($shuttleTypes);
        if ($collection->isEmpty()) {
            return;
        }

        $d = \Carbon\Carbon::parse($date)->toDateString();
        $ids = $collection->pluck('id');

        $rows = ShuttleTypePrice::query()
            ->whereIn('shuttle_type_id', $ids)
            ->where('effective_from', '<=', $d)
            ->orderByDesc('effective_from')
            ->get()
            ->groupBy('shuttle_type_id')
            ->map(fn ($group) => $group->first());

        foreach ($collection as $st) {
            $match = $rows->get($st->id);
            $st->setAttribute('price_for_bill', (int) ($match?->price ?? $st->price));
        }
    }

    public function prices()
    {
        return $this->hasMany(ShuttleTypePrice::class)->orderByDesc('effective_from');
    }

    // Relationships
    public function billShuttles()
    {
        return $this->hasMany(BillShuttle::class);
    }

    public function stockEntries()
    {
        return $this->hasMany(ShuttleStockEntry::class);
    }
}
