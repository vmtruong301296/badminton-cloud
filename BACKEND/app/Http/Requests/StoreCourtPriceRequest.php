<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** Lên giá sân: từ ngày áp dụng, một sân 2 giờ giá bao nhiêu. */
class StoreCourtPriceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'effective_from' => 'required|date',
            'price' => 'required|integer|min:1|max:100000000',
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'effective_from.required' => 'Vui lòng chọn ngày áp dụng.',
            'price.required' => 'Vui lòng nhập giá sân.',
            'price.min' => 'Giá sân phải lớn hơn 0.',
        ];
    }
}
