<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StorePartyBillRequest;
use App\Http\Requests\UpdatePartyBillRequest;
use App\Models\PartyBill;
use App\Models\PartyBillExtra;
use App\Models\PartyBillParticipant;
use App\Models\User;
use App\Services\PartyBillRecalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class PartyBillController extends Controller
{
    public function __construct(private PartyBillRecalculator $recalculator)
    {
    }

    public function index(): JsonResponse
    {
        $partyBills = PartyBill::with(['creator', 'extras', 'participants.user'])
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($partyBills);
    }

    public function store(StorePartyBillRequest $request): JsonResponse
    {
        try {
            DB::beginTransaction();

            $createdBy = $request->user()?->id;
            if (!$createdBy) {
                $fallbackUser = User::first();
                $createdBy = $fallbackUser?->id;
            }
            if (!$createdBy) {
                throw new \Exception('Không tìm thấy user để gán created_by. Vui lòng tạo ít nhất 1 user trong hệ thống.');
            }

            $baseAmount = (int) $request->base_amount;

            $extrasData = $request->extras ?? [];

            $participantsData = $request->participants;

            $partyBill = PartyBill::create([
                'date' => $request->date,
                'name' => $request->name ?: null,
                'note' => $request->note ?: null,
                'base_amount' => $baseAmount,
                'total_extra' => 0,
                'total_amount' => 0,
                'unit_price' => 0,
                'created_by' => $createdBy,
            ]);

            foreach ($extrasData as $extra) {
                PartyBillExtra::create([
                    'party_bill_id' => $partyBill->id,
                    'name' => $extra['name'],
                    'amount' => (int) $extra['amount'],
                ]);
            }

            foreach ($participantsData as $p) {
                PartyBillParticipant::create([
                    'party_bill_id' => $partyBill->id,
                    'user_id' => $p['user_id'] ?? null,
                    'name' => $p['name'],
                    'ratio_value' => isset($p['ratio_value']) ? (float) $p['ratio_value'] : 1,
                    'share_amount' => 0,
                    'total_amount' => 0,
                    'paid_amount' => isset($p['paid_amount']) ? (int) $p['paid_amount'] : 0,
                    'food_amount' => isset($p['food_amount']) ? (int) $p['food_amount'] : 0,
                    'note' => $p['note'] ?? null,
                    'is_paid' => $p['is_paid'] ?? false,
                    'paid_at' => ($p['is_paid'] ?? false) ? now() : null,
                ]);
            }

            // Mọi con số tiền do đây tính, đọc từ DB.
            $this->recalculator->recalculate($partyBill);

            DB::commit();

            $partyBill->load(['creator', 'extras', 'participants.user']);

            return response()->json($partyBill, 201);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Validation failed',
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('PartyBill creation error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all(),
            ]);
            return response()->json([
                'error' => $e->getMessage(),
                'message' => 'Có lỗi xảy ra khi tạo chia tiệc. Vui lòng kiểm tra lại dữ liệu.',
            ], 500);
        }
    }

    public function update(UpdatePartyBillRequest $request, string $id): JsonResponse
    {
        try {
            DB::beginTransaction();

            $partyBill = PartyBill::with(['participants'])->findOrFail($id);

            // Kiểm tra xem bill đã được thanh toán chưa
            // Bill được coi là đã thanh toán nếu TẤT CẢ participants đều đã thanh toán
            if ($this->recalculator->isFullyPaid($partyBill)) {
                // Nhánh này thoát sớm giữa transaction: phải rollback, không thì
                // connection bị bỏ lại với transaction đang mở.
                DB::rollBack();

                return response()->json([
                    'error' => 'Không thể sửa bill tiệc đã thanh toán',
                    'message' => 'Chỉ có thể sửa bill tiệc khi còn ít nhất một người chưa thanh toán.',
                ], 403);
            }

            $baseAmount = (int) $request->base_amount;

            $extrasData = $request->extras ?? [];

            $participantsData = $request->participants;

            // Update bill (giữ nguyên created_by)
            $partyBill->update([
                'date' => $request->date,
                'name' => $request->name ?: null,
                'note' => $request->note ?: null,
                'base_amount' => $baseAmount,
            ]);

            // Xóa các extras và participants cũ
            $partyBill->extras()->delete();
            $partyBill->participants()->delete();

            // Tạo lại extras
            foreach ($extrasData as $extra) {
                PartyBillExtra::create([
                    'party_bill_id' => $partyBill->id,
                    'name' => $extra['name'],
                    'amount' => (int) $extra['amount'],
                ]);
            }

            // Tạo lại participants
            foreach ($participantsData as $p) {
                PartyBillParticipant::create([
                    'party_bill_id' => $partyBill->id,
                    'user_id' => $p['user_id'] ?? null,
                    'name' => $p['name'],
                    'ratio_value' => isset($p['ratio_value']) ? (float) $p['ratio_value'] : 1,
                    'share_amount' => 0,
                    'total_amount' => 0,
                    'paid_amount' => isset($p['paid_amount']) ? (int) $p['paid_amount'] : 0,
                    'food_amount' => isset($p['food_amount']) ? (int) $p['food_amount'] : 0,
                    'note' => $p['note'] ?? null,
                    'is_paid' => $p['is_paid'] ?? false,
                    'paid_at' => ($p['is_paid'] ?? false) ? now() : null,
                ]);
            }

            $this->recalculator->recalculate($partyBill);

            DB::commit();

            $partyBill->load(['creator', 'extras', 'participants.user']);

            return response()->json($partyBill);
        } catch (\Illuminate\Validation\ValidationException $e) {
            DB::rollBack();
            return response()->json([
                'error' => 'Validation failed',
                'message' => $e->getMessage(),
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            DB::rollBack();
            \Log::error('PartyBill update error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
                'request' => $request->all(),
            ]);
            return response()->json([
                'error' => $e->getMessage(),
                'message' => 'Có lỗi xảy ra khi sửa chia tiệc. Vui lòng kiểm tra lại dữ liệu.',
            ], 500);
        }
    }

    public function show(string $id): JsonResponse
    {
        $partyBill = PartyBill::with(['creator', 'extras', 'participants.user'])->findOrFail($id);

        // Tính nợ cho từng người (dựa trên user_id, các bill trước ngày hiện tại, chưa thanh toán)
        foreach ($partyBill->participants as $participant) {
            $userId = $participant->user_id;
            if (!$userId || !$partyBill->date) {
                $participant->debt_amount = 0;
                $participant->debt_details = [];
                continue;
            }

            $previousBills = PartyBill::where('date', '<', $partyBill->date)
                ->whereHas('participants', function ($q) use ($userId) {
                    $q->where('user_id', $userId)->where('is_paid', false);
                })
                ->with(['participants' => function ($q) use ($userId) {
                    $q->where('user_id', $userId);
                }])
                ->orderBy('date', 'desc')
                ->get();

            $debtDetails = [];
            $totalDebt = 0;
            foreach ($previousBills as $prev) {
                $prevParticipant = $prev->participants->first();
                if ($prevParticipant && !$prevParticipant->is_paid) {
                    $amount = $prevParticipant->total_amount ?? 0;
                    $totalDebt += $amount;
                    $debtDetails[] = [
                        'date' => $prev->date?->format('Y-m-d'),
                        'amount' => $amount,
                        'bill_id' => $prev->id,
                        'name' => $prev->name,
                    ];
                }
            }

            $participant->debt_amount = $totalDebt;
            $participant->debt_details = $debtDetails;
        }

        return response()->json($partyBill);
    }

    public function destroy(string $id): JsonResponse
    {
        $partyBill = PartyBill::findOrFail($id);
        $partyBill->delete();

        return response()->json(['message' => 'Party bill deleted successfully']);
    }

    public function markPayment(Request $request, string $id, string $participantId): JsonResponse
    {
        $request->validate([
            'is_paid' => 'required|boolean',
        ]);

        $partyBill = PartyBill::findOrFail($id);
        $participant = PartyBillParticipant::where('party_bill_id', $partyBill->id)
            ->where('id', $participantId)
            ->firstOrFail();

        $isPaid = (bool) $request->is_paid;
        $participant->update([
            'is_paid' => $isPaid,
            'paid_at' => $isPaid ? Carbon::now() : null,
        ]);

        $participant->refresh();

        return response()->json([
            'message' => 'Cập nhật thanh toán thành công',
            'participant' => $participant,
        ]);
    }

    /**
     * Send exported party bill PNG to the Telegram chat configured via env.
     * Frontend POSTs `file` (PNG) + optional `caption`.
     */
    public function sendTelegram(Request $request, string $id): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimetypes:image/png,image/jpeg|max:10240',
        ]);

        $token = config('services.telegram.bot_token');
        $chatId = config('services.telegram.chat_id');
        if (! $token || ! $chatId) {
            return response()->json([
                'error' => 'Telegram chưa được cấu hình (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID).',
            ], 500);
        }

        $bill = PartyBill::findOrFail($id);
        $date = $bill->date ? Carbon::parse($bill->date)->format('d/m/Y') : '';
        $name = $bill->name ?: 'Bill tiệc';
        $caption = trim(($request->input('caption') ?: '')."\n{$name} #{$bill->id}".($date ? " - {$date}" : ''));

        $file = $request->file('file');
        $filename = 'party_bill_'.$bill->id.'.png';

        try {
            $response = Http::timeout(30)
                ->attach('document', file_get_contents($file->getRealPath()), $filename)
                ->post("https://api.telegram.org/bot{$token}/sendDocument", [
                    'chat_id' => $chatId,
                    'caption' => $caption,
                ]);

            if (! $response->successful()) {
                return response()->json([
                    'error' => 'Telegram API trả về lỗi',
                    'detail' => $response->json() ?: $response->body(),
                ], 502);
            }

            return response()->json(['ok' => true]);
        } catch (\Throwable $e) {
            return response()->json([
                'error' => 'Không thể gửi Telegram: '.$e->getMessage(),
            ], 500);
        }
    }
}

