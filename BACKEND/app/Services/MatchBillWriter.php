<?php

namespace App\Services;

use App\Models\Bill;
use App\Models\BillMatch;
use App\Models\BillPlayer;
use App\Models\BillShuttle;
use App\Models\ShuttleType;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Arr;

/**
 * Ghi bill chia theo trận: tổng tiền, các trận, chi tiết cầu gộp theo loại (để
 * kho cầu và thống kê tháng đọc như bill thường) và tiền từng người theo
 * MatchBillCalculator. bill_players.ratio_value lưu số trận người đó đánh.
 * player_ids của trận: nửa đầu là Cặp A, nửa sau là Cặp B (bill_match_players.side).
 *
 * Người gọi lo transaction, xoá dòng cũ khi sửa bill và trừ kho theo bill_shuttles.
 */
class MatchBillWriter
{
    public function __construct(private MatchBillCalculator $calculator) {}

    /**
     * @param  array{date: string, note?: string|null, court_total: int, court_slots?: array<int, array{start: string, end: string}>|null, matches: array<int, array{player_ids: array<int, int>, shuttles: array<int, array{shuttle_type_id: int, quantity: int}>}>}  $data
     * @param  array<int, array{is_paid: bool, paid_at: mixed}>  $paymentByUser  "Đã TT" giữ lại khi sửa bill
     */
    public function save(Bill $bill, array $data, array $paymentByUser = []): Bill
    {
        $matches = $this->priceMatches($data['matches'], Carbon::parse($data['date'])->toDateString());
        $courtTotal = (int) $data['court_total'];
        $shuttleTotal = array_sum(array_column($matches, 'subtotal'));

        $bill->fill([
            'date' => $data['date'],
            'note' => $data['note'] ?? null,
            'court_total' => $courtTotal,
            'court_slots' => ($data['court_slots'] ?? null) ?: null,
            'court_count' => null,
            'total_shuttle_price' => $shuttleTotal,
            'total_amount' => $courtTotal + $shuttleTotal,
            'unit_price' => 0,
            'split_mode' => Bill::SPLIT_MATCH,
        ])->save();

        foreach ($matches as $match) {
            $saved = $bill->matches()->create(Arr::only($match, ['position', 'subtotal']));
            $saved->shuttles()->createMany($match['shuttles']);
            $saved->players()->attach($this->playersWithSide($match['player_ids']));
        }

        $this->saveShuttleLines($bill, $matches);
        $this->savePlayers($bill, $courtTotal, $matches, $paymentByUser);

        return $bill;
    }

    /**
     * Giá cầu theo ngày bill cho từng dòng cầu của từng trận; subtotal của trận = tổng các dòng.
     *
     * @return array<int, array{position: int, subtotal: int, player_ids: array<int, int>, shuttles: array<int, array{shuttle_type_id: int, quantity: int, price_each: int, subtotal: int}>}>
     */
    private function priceMatches(array $matches, string $billDate): array
    {
        $typeIds = array_merge(...array_map(
            fn (array $match) => array_column($match['shuttles'], 'shuttle_type_id'),
            $matches,
        ));
        $prices = ShuttleType::findMany(array_unique($typeIds))
            ->mapWithKeys(fn (ShuttleType $type) => [$type->id => $type->priceForDate($billDate)]);

        $priced = [];
        foreach (array_values($matches) as $index => $match) {
            $shuttles = array_map(function (array $line) use ($prices) {
                $typeId = (int) $line['shuttle_type_id'];
                $quantity = (int) $line['quantity'];

                return [
                    'shuttle_type_id' => $typeId,
                    'quantity' => $quantity,
                    'price_each' => $prices[$typeId],
                    'subtotal' => $prices[$typeId] * $quantity,
                ];
            }, array_values($match['shuttles']));

            $priced[] = [
                'position' => $index + 1,
                'subtotal' => array_sum(array_column($shuttles, 'subtotal')),
                'player_ids' => array_map('intval', $match['player_ids']),
                'shuttles' => $shuttles,
            ];
        }

        return $priced;
    }

    /**
     * Nửa đầu người đánh là Cặp A, nửa sau là Cặp B, giữ thứ tự đã chọn.
     *
     * @param  array<int, int>  $playerIds
     * @return array<int, array{side: int}>
     */
    private function playersWithSide(array $playerIds): array
    {
        $half = intdiv(count($playerIds), 2);
        $attach = [];
        foreach (array_values($playerIds) as $index => $userId) {
            $attach[$userId] = ['side' => $index < $half ? BillMatch::SIDE_A : BillMatch::SIDE_B];
        }

        return $attach;
    }

    /** Một dòng bill_shuttles cho mỗi loại cầu, cộng dồn mọi trận. */
    private function saveShuttleLines(Bill $bill, array $matches): void
    {
        collect($matches)->pluck('shuttles')->flatten(1)->groupBy('shuttle_type_id')->each(function ($group, $typeId) use ($bill) {
            BillShuttle::create([
                'bill_id' => $bill->id,
                'shuttle_type_id' => $typeId,
                'quantity' => $group->sum('quantity'),
                'price_each' => $group->first()['price_each'],
                'subtotal' => $group->sum('subtotal'),
            ]);
        });
    }

    private function savePlayers(Bill $bill, int $courtTotal, array $matches, array $paymentByUser): void
    {
        $shares = $this->calculator->shares($courtTotal, $matches);
        $matchCounts = array_count_values(array_merge(...array_column($matches, 'player_ids')));
        $users = User::findMany(array_keys($shares))->keyBy('id');

        foreach ($shares as $userId => $share) {
            /** @var User $user */
            $user = $users[$userId];
            // Nợ cũ: cùng cách bill chia theo mức tính đang làm
            $debtAmount = $user->getCurrentDebtAmount();
            $payment = $paymentByUser[$userId] ?? ['is_paid' => false, 'paid_at' => null];

            BillPlayer::create([
                'bill_id' => $bill->id,
                'user_id' => $userId,
                'ratio_value' => $matchCounts[$userId],
                'menu_extra_total' => 0,
                'extra_amount' => 0,
                'extra_note' => null,
                'debt_amount' => $debtAmount,
                'debt_date' => $user->debts()->where('is_resolved', false)->orderBy('debt_date', 'desc')->first()?->debt_date,
                'share_amount' => $share,
                'total_amount' => $share + $debtAmount,
                'is_paid' => $payment['is_paid'],
                'paid_at' => $payment['paid_at'],
            ]);
        }
    }
}
