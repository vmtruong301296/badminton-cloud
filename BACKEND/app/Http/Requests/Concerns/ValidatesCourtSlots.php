<?php

namespace App\Http\Requests\Concerns;

/**
 * Khung giờ sân của bill con (court_slots, bảng "Tính theo giờ"), dùng chung cho tạo và sửa
 * bill: mỗi sân một giờ bắt đầu / kết thúc dạng HH:MM, kết thúc phải sau bắt đầu.
 */
trait ValidatesCourtSlots
{
    private const MAX_COURT_SLOTS = 20;

    /**
     * @return array<string, mixed>
     */
    protected function courtSlotsRules(): array
    {
        return [
            'court_slots' => ['nullable', 'array', 'max:'.self::MAX_COURT_SLOTS],
            'court_slots.*.start' => ['required', 'date_format:H:i'],
            'court_slots.*.end' => ['required', 'date_format:H:i', 'after:court_slots.*.start'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function courtSlotsMessages(): array
    {
        return [
            'court_slots.*.start.date_format' => 'Giờ bắt đầu của sân phải có dạng HH:MM.',
            'court_slots.*.end.date_format' => 'Giờ kết thúc của sân phải có dạng HH:MM.',
            'court_slots.*.end.after' => 'Giờ kết thúc phải sau giờ bắt đầu.',
        ];
    }
}
