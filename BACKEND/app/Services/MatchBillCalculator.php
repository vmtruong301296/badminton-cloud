<?php

namespace App\Services;

/**
 * Chia tiền bill theo trận.
 *
 * - Tiền sân chia đều cho số trận; phần sân của một trận chia cho người đánh
 *   trận đó (đôi 4 người, đơn 2 người).
 * - Tiền cầu của một trận chia cho người đánh trận đó.
 * - Mỗi người trả tổng phần của mọi trận mình đánh, làm tròn đồng ở cuối
 *   (không làm tròn từng trận để khỏi dồn sai số). Màn hình làm tròn nghìn khi
 *   hiển thị như mọi bill khác.
 *
 * Ví dụ: sân 55.000, trận 1 [A,B,C,D] cầu 26.000, trận 2 [A,C,E,F] cầu 56.000
 * → A = 6.875×2 + 6.500 + 14.000 = 34.250.
 */
class MatchBillCalculator
{
    /**
     * @param  array<int, array{player_ids: array<int, int>, subtotal: int}>  $matches
     * @return array<int, int> user_id => số tiền, theo thứ tự người xuất hiện lần đầu
     */
    public function shares(int $courtTotal, array $matches): array
    {
        if ($matches === []) {
            return [];
        }

        $courtPerMatch = $courtTotal / count($matches);
        $raw = [];

        foreach ($matches as $match) {
            $playerCount = count($match['player_ids']);
            $perPlayer = ($courtPerMatch + $match['subtotal']) / $playerCount;

            foreach ($match['player_ids'] as $userId) {
                $raw[$userId] = ($raw[$userId] ?? 0) + $perPlayer;
            }
        }

        return array_map(fn (float $amount) => (int) round($amount), $raw);
    }
}
