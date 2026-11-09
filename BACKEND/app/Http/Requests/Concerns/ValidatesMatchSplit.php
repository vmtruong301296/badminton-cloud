<?php

namespace App\Http\Requests\Concerns;

use App\Models\Bill;
use Illuminate\Validation\Rule;

/**
 * Luật cho bill chia theo trận (split_mode = match), dùng chung cho tạo và sửa
 * bill. Kiểu này không gửi players / shuttles: máy chủ suy ra người chơi và
 * chi tiết cầu từ các trận. matches.*.player_ids: nửa đầu là Cặp A, nửa sau là Cặp B.
 */
trait ValidatesMatchSplit
{
    /** Số người một trận: đôi hoặc đơn. */
    private const MATCH_PLAYER_COUNTS = [4, 2];

    private const MAX_MATCHES = 50;

    /** Số loại cầu tối đa trong một trận. */
    private const MAX_MATCH_SHUTTLES = 10;

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
            'matches.*.shuttles' => [$onlyMatch, 'required', 'array', 'min:1', 'max:'.self::MAX_MATCH_SHUTTLES, $this->matchShuttlesRule(...)],
            'matches.*.shuttles.*.shuttle_type_id' => [$onlyMatch, 'required', 'exists:shuttle_types,id'],
            'matches.*.shuttles.*.quantity' => [$onlyMatch, 'required', 'integer', 'min:1'],
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
            'matches.*.shuttles.required' => 'Mỗi trận cần ít nhất một loại cầu.',
            'matches.*.shuttles.min' => 'Mỗi trận cần ít nhất một loại cầu.',
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

    /** Mỗi loại cầu chỉ một dòng trong một trận. */
    private function matchShuttlesRule(string $attribute, mixed $value, \Closure $fail): void
    {
        if (! is_array($value)) {
            return;
        }
        $typeIds = array_filter(array_map(fn ($line) => is_array($line) ? ($line['shuttle_type_id'] ?? null) : null, $value));

        if (count($typeIds) !== count(array_unique($typeIds))) {
            $matchNo = (int) explode('.', $attribute)[1] + 1;
            $fail("Trận {$matchNo} có loại cầu bị chọn hai lần.");
        }
    }
}
