<?php

namespace App\Services\FuelPrice;

use App\Models\FuelPrice;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Lấy giá xăng từ các nguồn ngoài theo quy tắc "hai nguồn phải khớp".
 *
 * Một con số cào sai sẽ đi thẳng vào phép tính tiền, nên service này được
 * thiết kế để KHÔNG BAO GIỜ tự tin sai: chỉ cập nhật khi cả hai nguồn cho
 * kết quả bằng nhau tuyệt đối, mọi trường hợp còn lại giữ nguyên giá cũ và
 * ghi lý do vào last_error để hiển thị cho người dùng.
 */
class FuelPriceService
{
    /** @var array<int, FuelPriceSource> */
    private array $sources;

    public function __construct()
    {
        $min = (int) config('fuel_prices.min_price');
        $max = (int) config('fuel_prices.max_price');

        $this->sources = [
            new BaoHaTinhFuelSource($min, $max),
            new GiaVangNayFuelSource($min, $max),
        ];
    }

    /** Giá hiện tại, tự làm mới khi cache hết hạn. */
    public function current(string $fuelKey): FuelPrice
    {
        $ttl = now()->addMinutes((int) config('fuel_prices.cache_ttl_minutes'));

        $id = Cache::remember(
            $this->cacheKey($fuelKey),
            $ttl,
            fn () => $this->refresh($fuelKey)->id
        );

        return FuelPrice::findOrFail($id);
    }

    /** Buộc làm mới, bỏ qua cache. */
    public function refresh(string $fuelKey): FuelPrice
    {
        Cache::forget($this->cacheKey($fuelKey));

        $record = $this->recordFor($fuelKey);
        $pattern = $this->typeConfig($fuelKey)['pattern'];

        $results = [];
        $failed = [];

        foreach ($this->sources as $source) {
            $parsed = $this->fetchFrom($source, $fuelKey, $pattern);

            if ($parsed === null) {
                $failed[] = $source->name();
            } else {
                $results[$source->name()] = $parsed;
            }
        }

        $record->last_checked_at = now();

        $this->applyResult($record, $results, $failed);

        $record->save();

        return $record->fresh();
    }

    /** Quản trị viên đặt giá tay. */
    public function setManually(string $fuelKey, int $price, ?int $userId): FuelPrice
    {
        Cache::forget($this->cacheKey($fuelKey));

        $record = $this->recordFor($fuelKey);
        $record->price = $price;
        $record->sources = null;
        $record->source_date = null;
        $record->last_error = null;
        $record->updated_by = $userId;
        $record->save();

        return $record->fresh();
    }

    /** Mọi loại nhiên liệu đã cấu hình, kèm giá hiện tại. */
    public function all(): array
    {
        return array_map(
            fn (string $key) => $this->current($key),
            array_keys(config('fuel_prices.types', []))
        );
    }

    /**
     * Quyết định có cập nhật giá hay không. Đây là trái tim của quy tắc an toàn.
     *
     * @param  array<string, array{price: int, date: ?string}>  $results
     * @param  array<int, string>  $failed
     */
    private function applyResult(FuelPrice $record, array $results, array $failed): void
    {
        $prices = array_map(fn (array $r) => $r['price'], $results);

        if (count($prices) < count($this->sources)) {
            $record->last_error = $failed === []
                ? 'Không lấy được nguồn nào'
                : (count($prices) === 0
                    ? 'Cả hai nguồn đều không lấy được'
                    : sprintf(
                        'Chỉ lấy được %d/%d nguồn (%s lỗi)',
                        count($prices),
                        count($this->sources),
                        implode(', ', $failed)
                    ));

            return;
        }

        if (count(array_unique($prices)) > 1) {
            $record->last_error = 'Hai nguồn lệch nhau: '.implode(', ', array_map(
                fn (string $name, int $price) => $name.' '.number_format($price, 0, ',', '.'),
                array_keys($prices),
                array_values($prices)
            ));

            return;
        }

        // Hai nguồn khớp: đây là trường hợp DUY NHẤT được phép ghi đè giá.
        $date = null;
        foreach ($results as $parsed) {
            if ($parsed['date'] !== null) {
                $date = $parsed['date'];
                break;
            }
        }

        $record->price = (int) reset($prices);
        $record->sources = $prices;
        $record->source_date = $date;
        $record->fetched_at = now();
        $record->last_error = null;
        // Giá tự động tươi hơn giá nhập tay từ lâu, nên bỏ dấu "nhập tay".
        $record->updated_by = null;
    }

    /** @return array{price: int, date: ?string}|null */
    private function fetchFrom(FuelPriceSource $source, string $fuelKey, string $pattern): ?array
    {
        try {
            $response = Http::timeout((int) config('fuel_prices.source_timeout_seconds'))
                ->withHeaders(['User-Agent' => 'Mozilla/5.0 (BadmintonApp fuel price sync)'])
                ->get($source->url($fuelKey));

            if (! $response->successful()) {
                return null;
            }

            return $source->parse($response->body(), $pattern);
        } catch (Throwable $e) {
            Log::warning('Lấy giá xăng thất bại', [
                'source' => $source->name(),
                'fuel_key' => $fuelKey,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    private function recordFor(string $fuelKey): FuelPrice
    {
        return FuelPrice::firstOrCreate(
            ['fuel_key' => $fuelKey],
            ['price' => $this->typeConfig($fuelKey)['fallback_price'] ?? 0]
        );
    }

    private function typeConfig(string $fuelKey): array
    {
        $config = config("fuel_prices.types.{$fuelKey}");

        if (! is_array($config)) {
            throw new \InvalidArgumentException("Loại nhiên liệu không hợp lệ: {$fuelKey}");
        }

        return $config;
    }

    private function cacheKey(string $fuelKey): string
    {
        return "fuel_price:{$fuelKey}";
    }
}
