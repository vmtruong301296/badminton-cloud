<?php

namespace Tests\Feature;

use App\Models\CarRentalComparison;
use App\Models\CarRentalOption;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalModelTest extends TestCase
{
    use RefreshDatabase;

    private function makeComparison(): CarRentalComparison
    {
        return CarRentalComparison::create([
            'name' => 'Chuyến Đà Lạt',
            'date' => '2026-09-01',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 8,
            'note' => null,
            'break_even_km' => 181,
            'saving_amount' => 1300000,
            'created_by' => null,
        ]);
    }

    public function test_luu_va_doc_lai_comparison_kem_options(): void
    {
        $comparison = $this->makeComparison();

        $comparison->options()->create([
            'name' => 'Xe điện',
            'sort_order' => 1,
            'rental_per_day' => 690000,
            'fuel_type' => 'electric',
            'consumption_per_100' => 0,
            'fuel_unit_price' => 0,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
            'rental_cost' => 1380000,
            'fuel_cost' => 0,
            'over_km_cost' => 0,
            'total_cost' => 1380000,
            'cost_per_km' => 1725,
            'per_person_cost' => 172500,
            'is_cheapest' => true,
        ]);

        $comparison->options()->create([
            'name' => 'Xe xăng',
            'sort_order' => 0,
            'rental_per_day' => 500000,
            'fuel_type' => 'petrol',
            'consumption_per_100' => 7,
            'fuel_unit_price' => 30000,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
            'rental_cost' => 1000000,
            'fuel_cost' => 1680000,
            'over_km_cost' => 0,
            'total_cost' => 2680000,
            'cost_per_km' => 3350,
            'per_person_cost' => 335000,
            'is_cheapest' => false,
        ]);

        $fresh = CarRentalComparison::with('options')->find($comparison->id);

        $this->assertCount(2, $fresh->options);
        $this->assertSame('Xe xăng', $fresh->options[0]->name, 'options phải sắp theo sort_order');
        $this->assertTrue($fresh->options[1]->is_cheapest);
        $this->assertSame(7.0, $fresh->options[0]->consumption_per_100);
        $this->assertNull($fresh->options[0]->km_limit_per_day);
    }

    public function test_xoa_comparison_thi_xoa_luon_options(): void
    {
        $comparison = $this->makeComparison();
        $comparison->options()->create([
            'name' => 'Xe xăng',
            'sort_order' => 0,
            'rental_per_day' => 500000,
            'fuel_type' => 'petrol',
            'consumption_per_100' => 7,
            'fuel_unit_price' => 30000,
            'rental_cost' => 1000000,
            'fuel_cost' => 1680000,
            'total_cost' => 2680000,
            'cost_per_km' => 3350,
        ]);

        $comparison->delete();

        $this->assertSame(0, CarRentalOption::count());
    }
}
