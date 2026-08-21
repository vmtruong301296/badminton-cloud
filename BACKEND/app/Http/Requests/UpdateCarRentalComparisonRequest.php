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
            'shared_costs' => 'nullable|array',
            'shared_costs.*.name' => 'nullable|string|max:255',
            'shared_costs.*.amount' => 'nullable|integer|min:0',
            'party_bill_id' => 'nullable|integer|exists:party_bills,id',
            'selected_sort_order' => 'nullable|integer|min:0',
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
            'party_bill_id.exists' => 'Bill tiệc được chọn không tồn tại.',
            'options.min' => 'Cần ít nhất 2 phương án để so sánh.',
            'options.*.fuel_type.in' => 'Loại nhiên liệu phải là xăng, điện hoặc không tốn.',
            'days.min' => 'Số ngày thuê phải từ 1 trở lên.',
            'shared_costs.*.amount.min' => 'Chi phí chung không được âm.',
        ];
    }
}
