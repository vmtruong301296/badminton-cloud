<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateBillRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, \Illuminate\Contracts\Validation\ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'date' => 'required|date',
            'note' => 'nullable|string',
            'court_total' => 'required|integer|min:0',
            'court_count' => 'nullable|integer|min:1',
            'parent_bill_id' => 'nullable|exists:bills,id',
            'shuttles' => 'required|array|min:1',
            'shuttles.*.shuttle_type_id' => 'required|exists:shuttle_types,id',
            'shuttles.*.quantity' => 'required|integer|min:1',
            'players' => 'required|array|min:1',
            'players.*.user_id' => 'required|exists:users,id',
            'players.*.ratio_value' => 'nullable|numeric|min:0',
            'players.*.menus' => 'nullable|array',
            'players.*.menus.*.menu_id' => 'required_with:players.*.menus|exists:menus,id',
            'players.*.menus.*.quantity' => 'required_with:players.*.menus|integer|min:1',
        ];
    }
}
