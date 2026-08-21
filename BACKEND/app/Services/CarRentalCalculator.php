<?php

namespace App\Services;

class CarRentalCalculator
{
    /**
     * Sai số cho phép khi so sánh hai chi phí biến đổi (đ/km) dạng float.
     */
    private const EPSILON = 0.000001;

    public function calculate(array $input): array
    {
        $days = (int) ($input['days'] ?? 0);
        $distanceKm = (int) ($input['distance_km'] ?? 0);
        $peopleCount = (int) ($input['people_count'] ?? 0);

        $options = [];
        foreach (array_values($input['options'] ?? []) as $index => $raw) {
            $options[] = $this->calculateOption($raw, $index, $days, $distanceKm, $peopleCount);
        }

        $options = $this->markCheapest($options);

        return [
            'break_even_km' => $this->breakEvenKm($options, $days),
            'saving_amount' => $this->savingAmount($options),
            'options' => $options,
        ];
    }

    private function calculateOption(
        array $raw,
        int $index,
        int $days,
        int $distanceKm,
        int $peopleCount
    ): array {
        $fuelType = $raw['fuel_type'] ?? 'none';
        $rentalPerDay = (int) ($raw['rental_per_day'] ?? 0);
        $consumption = $fuelType === 'none' ? 0.0 : (float) ($raw['consumption_per_100'] ?? 0);
        $fuelUnitPrice = (int) ($raw['fuel_unit_price'] ?? 0);
        $extraFixedCost = (int) ($raw['extra_fixed_cost'] ?? 0);
        $overKmFee = (int) ($raw['over_km_fee'] ?? 0);

        $kmLimitPerDay = ($raw['km_limit_per_day'] ?? null) !== null
            ? (int) $raw['km_limit_per_day']
            : null;

        $rentalCost = $rentalPerDay * $days;
        $fuelCost = (int) round($distanceKm * $consumption / 100 * $fuelUnitPrice);

        $overKm = $kmLimitPerDay === null
            ? 0
            : max(0, $distanceKm - $kmLimitPerDay * $days);
        $overKmCost = $overKm * $overKmFee;

        $totalCost = $rentalCost + $fuelCost + $overKmCost + $extraFixedCost;

        return [
            'name' => (string) ($raw['name'] ?? ''),
            'sort_order' => (int) ($raw['sort_order'] ?? $index),
            'rental_per_day' => $rentalPerDay,
            'fuel_type' => $fuelType,
            'consumption_per_100' => $consumption,
            'fuel_unit_price' => $fuelUnitPrice,
            'extra_fixed_cost' => $extraFixedCost,
            'km_limit_per_day' => $kmLimitPerDay,
            'over_km_fee' => $overKmFee,
            'rental_cost' => $rentalCost,
            'fuel_cost' => $fuelCost,
            'over_km_cost' => $overKmCost,
            'total_cost' => $totalCost,
            'cost_per_km' => $distanceKm > 0 ? (int) round($totalCost / $distanceKm) : 0,
            'per_person_cost' => $peopleCount > 0 ? (int) round($totalCost / $peopleCount) : 0,
            'is_cheapest' => false,
        ];
    }

    /**
     * Đánh dấu phương án tổng tiền nhỏ nhất. Hòa thì sort_order nhỏ hơn thắng.
     */
    private function markCheapest(array $options): array
    {
        if ($options === []) {
            return $options;
        }

        $winner = 0;
        foreach ($options as $i => $option) {
            $best = $options[$winner];
            $cheaper = $option['total_cost'] < $best['total_cost'];
            $tieButEarlier = $option['total_cost'] === $best['total_cost']
                && $option['sort_order'] < $best['sort_order'];

            if ($cheaper || $tieButEarlier) {
                $winner = $i;
            }
        }

        $options[$winner]['is_cheapest'] = true;

        return $options;
    }

    private function savingAmount(array $options): int
    {
        if (count($options) < 2) {
            return 0;
        }

        $totals = array_column($options, 'total_cost');
        sort($totals);

        return $totals[1] - $totals[0];
    }

    /**
     * Quãng đường mà hai phương án hòa chi phí.
     *
     * Chỉ tính khi có đúng 2 phương án và CỐ Ý bỏ qua phí vượt km, vì phí vượt
     * là hàm bậc thang làm bài toán mất tính tuyến tính. UI phải ghi rõ
     * "(chưa tính phí vượt km)" khi người dùng có bật giới hạn km.
     */
    private function breakEvenKm(array $options, int $days): ?int
    {
        if (count($options) !== 2) {
            return null;
        }

        [$a, $b] = $options;

        $fixedA = $a['rental_per_day'] * $days + $a['extra_fixed_cost'];
        $fixedB = $b['rental_per_day'] * $days + $b['extra_fixed_cost'];
        $varA = $a['consumption_per_100'] / 100 * $a['fuel_unit_price'];
        $varB = $b['consumption_per_100'] / 100 * $b['fuel_unit_price'];

        if (abs($varA - $varB) < self::EPSILON) {
            return null;
        }

        $distance = ($fixedB - $fixedA) / ($varA - $varB);

        return $distance > 0 ? (int) round($distance) : null;
    }
}
