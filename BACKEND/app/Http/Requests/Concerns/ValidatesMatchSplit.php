<?php

namespace App\Http\Requests\Concerns;

use App\Models\Bill;
use Illuminate\Validation\Rule;

/**
 * Luật cho bill chia theo trận (split_mode = match), dùng chung cho tạo và sửa
 * bill. Kiểu này không gửi players / shuttles: máy chủ suy ra người chơi và
 * chi tiết cầu từ các trận.
 */
trait ValidatesMatchSplit
{
    /** Số người một trận: đôi hoặc đơn. */
    private const MATCH_PLAYER_COUNTS = [4, 2];

    private const MAX_MATCHES = 50;

    protected function isMatchSplit(): bool
    {
        return $this->input('split_mode') === Bill::SPLIT_MATCH;
    }

    /**
     * @return array<string, mixed>
     */
    protected function matchSplitRules(): array
    {
        $onlyMatch = 'exclude_unless:split_mode,'.Bill::SPLIT_MATCH;

        return [
            'split_mode' => ['nullable', Rule::in([Bill::SPLIT_RATIO, Bill::SPLIT_MATCH])],
            'matches' => [$onlyMatch, 'required', 'array', 'min:1', 'max:'.self::MAX_MATCHES],
            'matches.*.player_ids' => [$onlyMatch, 'required', 'array', $this->matchPlayersRule(...)],
            'matches.*.player_ids.*' => [$onlyMatch, 'integer', 'exists:users,id'],
            'matches.*.shuttle_type_id' => [$onlyMatch, 'required', 'exists:shuttle_types,id'],
            'matches.*.quantity' => [$onlyMatch, 'required', 'integer', 'min:1'],
        ];
    }

    /**
     * @return array<string, string>
     */
    protected function matchSplitMessages(): array
    {
        return [
            'matches.required' => 'Cần ít nhất một trận.',
            'matches.min' => 'Cần ít nhất một trận.',
        ];
    }

    /** Trận đủ 4 người (đôi) hoặc 2 người (đơn), không ai bị chọn hai lần trong trận. */
    private function matchPlayersRule(string $attribute, mixed $value, \Closure $fail): void
    {
        if (! is_array($value)) {
            return;
        }
        $matchNo = (int) explode('.', $attribute)[1] + 1;

        if (count($value) !== count(array_unique($value))) {
            $fail("Trận {$matchNo} có người bị chọn hai lần.");
        } elseif (! in_array(count($value), self::MATCH_PLAYER_COUNTS, true)) {
            $fail("Trận {$matchNo} cần đủ 4 người (đánh đôi) hoặc 2 người (đánh đơn).");
        }
    }
}
