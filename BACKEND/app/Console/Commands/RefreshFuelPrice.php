<?php

namespace App\Console\Commands;

use App\Services\FuelPrice\FuelPriceService;
use Illuminate\Console\Command;

class RefreshFuelPrice extends Command
{
    protected $signature = 'fuel-price:refresh {fuelKey? : Bỏ trống để làm mới mọi loại}';

    protected $description = 'Cào lại giá xăng từ các nguồn ngoài (chỉ cập nhật khi hai nguồn khớp)';

    public function handle(FuelPriceService $service): int
    {
        $keys = $this->argument('fuelKey')
            ? [$this->argument('fuelKey')]
            : array_keys(config('fuel_prices.types', []));

        $rows = [];
        $hasError = false;

        foreach ($keys as $key) {
            $price = $service->refresh($key);

            if ($price->last_error) {
                $hasError = true;
            }

            $rows[] = [
                $price->fuel_key,
                number_format($price->price, 0, ',', '.').' đ/lít',
                $price->sources ? implode(' + ', array_keys($price->sources)) : 'nhập tay',
                $price->fetched_at?->format('d/m/Y H:i') ?? 'chưa từng',
                $price->last_error ?? 'OK',
            ];
        }

        $this->table(['Loại', 'Giá', 'Nguồn', 'Cào lúc', 'Trạng thái'], $rows);

        return $hasError ? self::FAILURE : self::SUCCESS;
    }
}
