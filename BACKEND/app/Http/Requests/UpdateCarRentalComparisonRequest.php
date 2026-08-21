<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCarRentalComparisonRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'nullable|string|max:255',
            'date' => 'nullable|date',
            'days' => 'required|integer|min:1',
            'distance_km' => 'required|integer|min:0',
            'people_count' => 'nullable|integer|min:0',
            'note' => 'nullable|string',
            'options' => 'required|array|min:2',
            'options.*.name' => 'required|string|max:255',
            'options.*.sort_order' => 'nullable|integer|min:0',
            'options.*.rental_per_day' => 'required|integer|min:0',
            'options.*.fuel_type' => 'required|in:petrol,electric,none',
            'options.*.consumption_per_100' => 'nullable|numeric|min:0',
            'options.*.fuel_unit_price' => 'nullable|integer|min:0',
            'options.*.extra_fixed_cost' => 'nullable|integer|min:0',
            'options.*.km_limit_per_day' => 'nullable|integer|min:1',
            'options.*.over_km_fee' => 'nullable|integer|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'options.min' => 'Cần ít nhất 2 phương án để so sánh.',
            'options.*.fuel_type.in' => 'Loại nhiên liệu phải là xăng, điện hoặc không tốn.',
            'days.min' => 'Số ngày thuê phải từ 1 trở lên.',
        ];
    }
}
