<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FuelPrice;
use App\Services\FuelPrice\FuelPriceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

class FuelPriceController extends Controller
{
    public function __construct(private FuelPriceService $service)
    {
    }

    public function index(): JsonResponse
    {
        return response()->json(
            array_map(fn (FuelPrice $price) => $this->present($price), $this->service->all())
        );
    }

    public function refresh(string $fuelKey): JsonResponse
    {
        $this->assertKnown($fuelKey);

        return response()->json($this->present($this->service->refresh($fuelKey)));
    }

    public function update(Request $request, string $fuelKey): JsonResponse
    {
        $this->assertKnown($fuelKey);

        $validated = $request->validate([
            'price' => [
                'required',
                'integer',
                'min:'.config('fuel_prices.min_price'),
                'max:'.config('fuel_prices.max_price'),
            ],
        ], [
            'price.min' => 'Giá xăng phải từ '.number_format((int) config('fuel_prices.min_price'), 0, ',', '.').' đ/lít trở lên.',
            'price.max' => 'Giá xăng không được quá '.number_format((int) config('fuel_prices.max_price'), 0, ',', '.').' đ/lít.',
        ]);

        $price = $this->service->setManually($fuelKey, (int) $validated['price'], $request->user()?->id);

        return response()->json($this->present($price));
    }

    private function assertKnown(string $fuelKey): void
    {
        if (! is_array(config("fuel_prices.types.{$fuelKey}"))) {
            throw new NotFoundHttpException("Loại nhiên liệu không tồn tại: {$fuelKey}");
        }
    }

    private function present(FuelPrice $price): array
    {
        return [
            'fuel_key' => $price->fuel_key,
            'label' => $price->label(),
            'price' => $price->price,
            'sources' => $price->sources,
            'source_date' => $price->source_date?->format('Y-m-d'),
            'fetched_at' => $price->fetched_at?->toIso8601String(),
            'last_checked_at' => $price->last_checked_at?->toIso8601String(),
            'last_error' => $price->last_error,
            'is_manual' => $price->isManual(),
            'is_stale' => $price->isStale(),
        ];
    }
}
