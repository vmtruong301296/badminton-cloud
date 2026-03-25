<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class StoreShuttleStockEntryRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'tubes' => 'nullable|integer|min:0',
            'balls' => 'nullable|integer|min:0',
            'entered_at' => 'nullable|date',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $v) {
            $tubes = (int) $this->input('tubes', 0);
            $balls = (int) $this->input('balls', 0);
            if ($tubes * 12 + $balls <= 0) {
                $v->errors()->add('balls', 'Nhập ít nhất số ống hoặc số quả (tổng phải lớn hơn 0).');
            }
        });
    }
}
