<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdatePartyBillRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'date' => 'required|date',
            'name' => 'required|string|max:255',
            'note' => 'nullable|string',
            'base_amount' => 'required|integer|min:0',
            'extras' => 'nullable|array',
            'extras.*.name' => 'required_with:extras.*.amount|string|max:255',
            'extras.*.amount' => 'required_with:extras.*.name|integer|min:0',
            'participants' => 'required|array|min:1',
            'participants.*.user_id' => 'nullable|exists:users,id',
            'participants.*.name' => 'required|string|max:255',
            'participants.*.ratio_value' => 'nullable|numeric|min:0',
            'participants.*.paid_amount' => 'nullable|integer|min:0',
            'participants.*.food_amount' => 'nullable|integer|min:0',
            'participants.*.note' => 'nullable|string',
            'participants.*.is_paid' => 'nullable|boolean',
        ];
    }
}

