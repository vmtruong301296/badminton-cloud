# Gắn lần thuê xe vào bill tiệc — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mỗi lần thuê xe gắn được vào tối đa một bill tiệc; chi phí chuyến đi hiện thành một dòng chi phí thêm bên bill tiệc và được chia cho người tham gia, liên kết sống theo hai chiều dữ liệu.

**Architecture:** Dòng chi phí thêm mang cờ `car_rental_comparison_id` để đánh dấu "do thuê xe sở hữu". `PartyBillController::update()` không được xóa các dòng đó, và toàn bộ phép tính tiền chuyển sang `PartyBillRecalculator` đọc **từ DB** thay vì từ payload — vì payload màn bill tiệc không hề biết đến dòng do thuê xe sở hữu.

**Tech Stack:** Laravel 12 (PHP 8.4), PHPUnit + SQLite in-memory, React 19, Tailwind 3, Axios.

**Spec:** `docs/superpowers/specs/2026-08-21-car-rental-party-bill-link-design.md`

## Global Constraints

- **Thứ tự các task là bắt buộc.** Task 1 (test khóa hành vi) phải xanh **trước** khi Task 2 đụng vào code tiền. Không được đảo.
- **Không sửa kỳ vọng của Task 1** trong bất kỳ task nào sau đó. Nếu Task 1 đỏ sau refactor thì refactor sai, không phải test sai.
- Mọi giá trị tiền là **số nguyên đồng**.
- **Hai hành vi sẵn có cố ý giữ nguyên, không được "sửa cho đẹp":**
  1. `Σ ratio_value = 0` → `unit_price = 0`.
  2. Tổng các `share_amount` có thể lệch `total_amount` vài đồng do làm tròn từng dòng.
  3. `Collection::every()` trên tập rỗng trả `true` — giữ nguyên ngữ nghĩa "bill không có ai tham gia thì coi như đã thanh toán hết", đúng như code hiện tại.
- `ratio_value` được cast `decimal:3` nên Eloquent **trả về chuỗi**. Luôn ép `(float)` trước khi tính.
- Backend chỉ chặn `middleware('auth')`, không kiểm tra quyền ở tầng server — đúng pattern hiện hành của repo.
- **TUYỆT ĐỐI KHÔNG sửa và không commit `FRONTEND/vite.config.js`.**
- Commit thẳng lên `main`, không tạo feature branch.
- Chuỗi hiển thị cho người dùng viết bằng **tiếng Việt có dấu**.
- Lệnh test: `cd BACKEND && php artisan test`, `cd FRONTEND && npm test`.

---

### Task 1: Test khóa hành vi tiền của bill tiệc

Không viết code sản phẩm nào. Deliverable là một bộ test xanh mô tả **hành vi hiện tại**, để Task 2 refactor mà không đổi hành vi.

**Files:**
- Test: `BACKEND/tests/Feature/PartyBillMoneyTest.php`

**Interfaces:**
- Consumes: không có
- Produces: bộ test phải xanh ở mọi task sau. Không task nào được sửa kỳ vọng trong file này.

- [ ] **Step 1: Viết test khóa hành vi**

```php
<?php

namespace Tests\Feature;

use App\Models\PartyBill;
use App\Models\PartyBillParticipant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * KHÓA HÀNH VI TIỀN CỦA BILL TIỆC.
 *
 * File này mô tả hành vi ĐANG CHẠY THẬT trước khi tách PartyBillRecalculator.
 * Nếu nó đỏ sau refactor thì refactor sai, KHÔNG được sửa kỳ vọng ở đây.
 */
class PartyBillMoneyTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'name' => 'Người test',
            'email' => 'test@example.com',
            'password' => 'secret123',
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'date' => '2026-09-01',
            'name' => 'Tiệc test',
            'note' => null,
            'base_amount' => 1000000,
            'extras' => [
                ['name' => 'Bánh', 'amount' => 200000],
                ['name' => 'Nước', 'amount' => 300000],
            ],
            'participants' => [
                ['name' => 'An', 'ratio_value' => 1],
                ['name' => 'Bình', 'ratio_value' => 1],
                ['name' => 'Chi', 'ratio_value' => 0.5],
            ],
        ], $overrides);
    }

    public function test_tao_bill_tinh_dung_tong_va_don_gia(): void
    {
        $response = $this->actingAs($this->user())
            ->postJson('/api/party-bills', $this->payload());

        // base 1.000.000 + extras 500.000 = 1.500.000
        // sum ratio = 2.5  =>  unit_price = 600.000
        $response->assertStatus(201)
            ->assertJsonPath('total_extra', 500000)
            ->assertJsonPath('total_amount', 1500000)
            ->assertJsonPath('unit_price', 600000);
    }

    public function test_tao_bill_tinh_dung_share_tung_nguoi(): void
    {
        $id = $this->actingAs($this->user())
            ->postJson('/api/party-bills', $this->payload())
            ->json('id');

        $bill = PartyBill::with('participants')->find($id);
        $shares = $bill->participants->pluck('share_amount', 'name')->all();

        $this->assertSame(600000, $shares['An']);
        $this->assertSame(600000, $shares['Bình']);
        $this->assertSame(300000, $shares['Chi']);
    }

    public function test_thanh_tien_bang_share_cong_do_an_tru_da_tra(): void
    {
        $payload = $this->payload([
            'participants' => [
                ['name' => 'An', 'ratio_value' => 1, 'food_amount' => 50000, 'paid_amount' => 0],
                ['name' => 'Bình', 'ratio_value' => 1, 'food_amount' => 0, 'paid_amount' => 2000000],
            ],
        ]);

        $id = $this->actingAs($this->user())->postJson('/api/party-bills', $payload)->json('id');
        $bill = PartyBill::with('participants')->find($id);

        // sum ratio = 2 => unit_price = 750.000
        $an = $bill->participants->firstWhere('name', 'An');
        $binh = $bill->participants->firstWhere('name', 'Bình');

        $this->assertSame(800000, $an->total_amount);            // 750k + 50k - 0
        $this->assertSame(-1250000, $binh->total_amount);        // 750k + 0 - 2.000k, ÂM là đúng
    }

    public function test_khong_co_extras_thi_total_extra_bang_0(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/party-bills', $this->payload(['extras' => []]))
            ->assertStatus(201)
            ->assertJsonPath('total_extra', 0)
            ->assertJsonPath('total_amount', 1000000);
    }

    public function test_tong_ratio_bang_0_thi_don_gia_bang_0(): void
    {
        $payload = $this->payload([
            'participants' => [
                ['name' => 'An', 'ratio_value' => 0],
                ['name' => 'Bình', 'ratio_value' => 0],
            ],
        ]);

        $this->actingAs($this->user())
            ->postJson('/api/party-bills', $payload)
            ->assertStatus(201)
            ->assertJsonPath('unit_price', 0);
    }

    public function test_sua_bill_tinh_lai_toan_bo(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)->postJson('/api/party-bills', $this->payload())->json('id');

        $this->actingAs($user)
            ->putJson("/api/party-bills/{$id}", $this->payload([
                'base_amount' => 2000000,
                'extras' => [['name' => 'Bánh', 'amount' => 500000]],
            ]))
            ->assertStatus(200)
            ->assertJsonPath('total_extra', 500000)
            ->assertJsonPath('total_amount', 2500000)
            ->assertJsonPath('unit_price', 1000000);
    }

    public function test_sua_bill_thay_the_toan_bo_extras(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)->postJson('/api/party-bills', $this->payload())->json('id');

        $response = $this->actingAs($user)->putJson("/api/party-bills/{$id}", $this->payload([
            'extras' => [['name' => 'Chỉ còn một', 'amount' => 100000]],
        ]));

        $response->assertStatus(200)->assertJsonCount(1, 'extras');
        $this->assertSame('Chỉ còn một', $response->json('extras.0.name'));
    }

    public function test_bill_da_thanh_toan_het_thi_khong_sua_duoc(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)->postJson('/api/party-bills', $this->payload())->json('id');

        PartyBillParticipant::where('party_bill_id', $id)->update(['is_paid' => true]);

        $this->actingAs($user)
            ->putJson("/api/party-bills/{$id}", $this->payload(['base_amount' => 999]))
            ->assertStatus(403);
    }

    public function test_con_mot_nguoi_chua_tra_thi_van_sua_duoc(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)->postJson('/api/party-bills', $this->payload())->json('id');

        PartyBillParticipant::where('party_bill_id', $id)->update(['is_paid' => true]);
        PartyBillParticipant::where('party_bill_id', $id)->limit(1)->update(['is_paid' => false]);

        $this->actingAs($user)
            ->putJson("/api/party-bills/{$id}", $this->payload(['base_amount' => 2000000]))
            ->assertStatus(200);
    }
}
```

- [ ] **Step 2: Chạy test — phải XANH ngay, không sửa gì cả**

Run: `cd BACKEND && php artisan test --filter=PartyBillMoneyTest`
Expected: PASS, 9 tests.

Nếu có test nào đỏ thì **dừng lại và báo người dùng**: nghĩa là hành vi thật khác với mô tả trong spec, phải làm rõ trước khi refactor. Không được sửa kỳ vọng cho vừa.

- [ ] **Step 3: Commit**

```bash
git add BACKEND/tests/Feature/PartyBillMoneyTest.php
git commit -m "test(party-bill): khóa hành vi tính tiền trước khi refactor"
```

---

### Task 2: Tách `PartyBillRecalculator`

**Files:**
- Create: `BACKEND/app/Services/PartyBillRecalculator.php`
- Modify: `BACKEND/app/Http/Controllers/Api/PartyBillController.php`
- Test: `BACKEND/tests/Unit/PartyBillRecalculatorTest.php`

**Interfaces:**
- Consumes: bộ test Task 1 (phải giữ xanh)
- Produces:
  - `App\Services\PartyBillRecalculator::recalculate(PartyBill $bill): PartyBill`
  - `App\Services\PartyBillRecalculator::isFullyPaid(PartyBill $bill): bool`

- [ ] **Step 1: Viết test cho service**

Tạo `BACKEND/tests/Unit/PartyBillRecalculatorTest.php`. Dùng `Tests\TestCase` + `RefreshDatabase` vì service đọc ghi DB:

```php
<?php

namespace Tests\Unit;

use App\Models\PartyBill;
use App\Services\PartyBillRecalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PartyBillRecalculatorTest extends TestCase
{
    use RefreshDatabase;

    private PartyBillRecalculator $recalculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->recalculator = app(PartyBillRecalculator::class);
    }

    private function bill(int $baseAmount = 1000000): PartyBill
    {
        return PartyBill::create([
            'date' => '2026-09-01',
            'name' => 'Tiệc test',
            'base_amount' => $baseAmount,
            'total_extra' => 0,
            'total_amount' => 0,
            'unit_price' => 0,
        ]);
    }

    private function addParticipant(PartyBill $bill, string $name, float $ratio, array $extra = []): void
    {
        $bill->participants()->create(array_merge([
            'name' => $name,
            'ratio_value' => $ratio,
            'share_amount' => 0,
            'total_amount' => 0,
            'paid_amount' => 0,
            'food_amount' => 0,
            'is_paid' => false,
        ], $extra));
    }

    public function test_tinh_don_gia_va_share_voi_ti_le_le(): void
    {
        $bill = $this->bill(1000000);
        $bill->extras()->create(['name' => 'Bánh', 'amount' => 500000]);
        $this->addParticipant($bill, 'An', 1);
        $this->addParticipant($bill, 'Bình', 0.5);
        $this->addParticipant($bill, 'Chi', 1.5);

        $result = $this->recalculator->recalculate($bill);

        // 1.500.000 / 3 = 500.000
        $this->assertSame(500000, $result->total_extra);
        $this->assertSame(1500000, $result->total_amount);
        $this->assertSame(500000, $result->unit_price);

        $shares = $result->participants->pluck('share_amount', 'name')->all();
        $this->assertSame(500000, $shares['An']);
        $this->assertSame(250000, $shares['Bình']);
        $this->assertSame(750000, $shares['Chi']);
    }

    public function test_tong_ratio_bang_0_khong_chia_cho_0(): void
    {
        $bill = $this->bill();
        $this->addParticipant($bill, 'An', 0);

        $result = $this->recalculator->recalculate($bill);

        $this->assertSame(0, $result->unit_price);
        $this->assertSame(0, $result->participants->first()->share_amount);
    }

    public function test_giu_nguyen_da_tra_do_an_va_trang_thai(): void
    {
        $bill = $this->bill(1000000);
        $this->addParticipant($bill, 'An', 1, [
            'paid_amount' => 300000,
            'food_amount' => 50000,
            'is_paid' => true,
            'note' => 'ghi chú giữ nguyên',
        ]);

        $participant = $this->recalculator->recalculate($bill)->participants->first();

        $this->assertSame(300000, $participant->paid_amount);
        $this->assertSame(50000, $participant->food_amount);
        $this->assertTrue($participant->is_paid);
        $this->assertSame('ghi chú giữ nguyên', $participant->note);
        // share 1.000.000 + food 50.000 - paid 300.000
        $this->assertSame(750000, $participant->total_amount);
    }

    public function test_thanh_tien_am_duoc(): void
    {
        $bill = $this->bill(100000);
        $this->addParticipant($bill, 'An', 1, ['paid_amount' => 500000]);

        $this->assertSame(-400000, $this->recalculator->recalculate($bill)->participants->first()->total_amount);
    }

    public function test_cong_ca_dong_thu_cong_lan_dong_do_thue_xe_so_huu(): void
    {
        $bill = $this->bill(0);
        $bill->extras()->create(['name' => 'Thủ công', 'amount' => 100000]);
        // Dòng sở hữu được mô phỏng bằng cột car_rental_comparison_id (Task 3
        // tạo cột này). Ở Task 2 cột chưa có, nên test này chỉ kiểm rằng MỌI
        // dòng extras trong DB đều được cộng, bất kể đến từ đâu.
        $bill->extras()->create(['name' => 'Dòng thứ hai', 'amount' => 250000]);
        $this->addParticipant($bill, 'An', 1);

        $result = $this->recalculator->recalculate($bill);

        $this->assertSame(350000, $result->total_extra);
        $this->assertSame(350000, $result->unit_price);
    }

    public function test_is_fully_paid(): void
    {
        $bill = $this->bill();
        $this->addParticipant($bill, 'An', 1, ['is_paid' => true]);
        $this->addParticipant($bill, 'Bình', 1, ['is_paid' => false]);

        $this->assertFalse($this->recalculator->isFullyPaid($bill->fresh('participants')));

        $bill->participants()->update(['is_paid' => true]);

        $this->assertTrue($this->recalculator->isFullyPaid($bill->fresh('participants')));
    }
}
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd BACKEND && php artisan test --filter=PartyBillRecalculatorTest`
Expected: FAIL — `Target class [App\Services\PartyBillRecalculator] does not exist.`

- [ ] **Step 3: Viết service**

Tạo `BACKEND/app/Services/PartyBillRecalculator.php`:

```php
<?php

namespace App\Services;

use App\Models\PartyBill;

/**
 * Tính lại tổng tiền và phần chia của từng người tham gia một bill tiệc.
 *
 * Điểm mấu chốt: đọc TỪ DB, không đọc request. Nhờ vậy dòng chi phí thêm do
 * thuê xe sở hữu luôn được cộng vào, dù payload của màn bill tiệc không hề
 * biết đến nó.
 */
class PartyBillRecalculator
{
    public function recalculate(PartyBill $bill): PartyBill
    {
        $bill->load(['extras', 'participants']);

        $totalExtra = (int) $bill->extras->sum('amount');
        $totalAmount = (int) $bill->base_amount + $totalExtra;

        $sumRatios = 0.0;
        foreach ($bill->participants as $participant) {
            // ratio_value cast decimal:3 nên Eloquent trả về CHUỖI.
            $sumRatios += (float) $participant->ratio_value;
        }

        $unitPrice = $sumRatios > 0 ? (int) round($totalAmount / $sumRatios) : 0;

        $bill->update([
            'total_extra' => $totalExtra,
            'total_amount' => $totalAmount,
            'unit_price' => $unitPrice,
        ]);

        foreach ($bill->participants as $participant) {
            $shareAmount = (int) round((float) $participant->ratio_value * $unitPrice);

            $participant->update([
                'share_amount' => $shareAmount,
                'total_amount' => $shareAmount
                    + (int) $participant->food_amount
                    - (int) $participant->paid_amount,
            ]);
        }

        return $bill->fresh(['extras', 'participants']);
    }

    /**
     * Bill đã thanh toán hết.
     *
     * Giữ NGUYÊN ngữ nghĩa của code cũ, kể cả việc Collection::every() trên
     * tập rỗng trả true. Không "sửa cho đẹp" trong lúc refactor.
     */
    public function isFullyPaid(PartyBill $bill): bool
    {
        $bill->loadMissing('participants');

        return $bill->participants->every(fn ($participant) => $participant->is_paid === true);
    }
}
```

- [ ] **Step 4: Chạy test service**

Run: `cd BACKEND && php artisan test --filter=PartyBillRecalculatorTest`
Expected: PASS, 6 tests.

- [ ] **Step 5: Đấu service vào `PartyBillController`**

Trong `BACKEND/app/Http/Controllers/Api/PartyBillController.php`:

Thêm import và constructor:

```php
use App\Services\PartyBillRecalculator;
```

```php
    public function __construct(private PartyBillRecalculator $recalculator)
    {
    }
```

**Trong `store()`**, thay đoạn tính tiền. Bỏ hết phần tính `$totalExtra`, `$totalAmount`, `$sumRatios`, `$unitPrice`, và tạo bill với 0:

```php
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
```

Tạo extras như cũ. Tạo participants với share tạm bằng 0:

```php
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
```

**Trong `update()`**, đổi phần kiểm tra đã thanh toán sang service:

```php
            if ($this->recalculator->isFullyPaid($partyBill)) {
```

Và thay `$partyBill->update([...])` bằng bản chỉ ghi trường không phải tiền:

```php
            $partyBill->update([
                'date' => $request->date,
                'name' => $request->name ?: null,
                'note' => $request->note ?: null,
                'base_amount' => $baseAmount,
            ]);
```

Giữ nguyên phần xóa và dựng lại extras/participants (Task 5 mới sửa phần xóa extras), nhưng participants tạo với `share_amount => 0`, `total_amount => 0` giống `store()`, rồi kết bằng:

```php
            $this->recalculator->recalculate($partyBill);
```

- [ ] **Step 6: Chạy test khóa hành vi — PHẢI VẪN XANH**

Run: `cd BACKEND && php artisan test --filter=PartyBillMoneyTest`
Expected: PASS, 9 tests, **không sửa một dòng kỳ vọng nào**.

Nếu đỏ: refactor sai. Đọc diff, sửa code sản phẩm, không sửa test.

- [ ] **Step 7: Chạy toàn bộ test backend**

Run: `cd BACKEND && php artisan test`
Expected: PASS toàn bộ.

- [ ] **Step 8: Commit**

```bash
git add BACKEND/app/Services/PartyBillRecalculator.php \
        BACKEND/app/Http/Controllers/Api/PartyBillController.php \
        BACKEND/tests/Unit/PartyBillRecalculatorTest.php
git commit -m "refactor(party-bill): tách PartyBillRecalculator, tính tiền từ DB thay vì payload"
```

---

### Task 3: Cột liên kết và quan hệ model

**Files:**
- Create: `BACKEND/database/migrations/2026_08_21_000040_add_party_bill_link_to_car_rentals.php`
- Modify: `BACKEND/app/Models/CarRentalComparison.php`
- Modify: `BACKEND/app/Models/PartyBillExtra.php`
- Modify: `BACKEND/app/Models/PartyBill.php`
- Test: `BACKEND/tests/Feature/CarRentalPartyBillSchemaTest.php`

**Interfaces:**
- Consumes: không có
- Produces:
  - `car_rental_comparisons.party_bill_id` (nullable, nullOnDelete), `car_rental_comparisons.selected_sort_order` (nullable)
  - `party_bill_extras.car_rental_comparison_id` (nullable, cascadeOnDelete)
  - `CarRentalComparison::partyBill(): BelongsTo`
  - `PartyBillExtra::carRentalComparison(): BelongsTo`
  - `PartyBill::carRentals(): HasMany`

- [ ] **Step 1: Viết test thất bại**

```php
<?php

namespace Tests\Feature;

use App\Models\CarRentalComparison;
use App\Models\PartyBill;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalPartyBillSchemaTest extends TestCase
{
    use RefreshDatabase;

    private function bill(): PartyBill
    {
        return PartyBill::create([
            'date' => '2026-09-01',
            'name' => 'Tiệc test',
            'base_amount' => 0,
            'total_extra' => 0,
            'total_amount' => 0,
            'unit_price' => 0,
        ]);
    }

    private function comparison(?int $billId = null): CarRentalComparison
    {
        return CarRentalComparison::create([
            'name' => 'Chuyến Đà Lạt',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'break_even_km' => 181,
            'saving_amount' => 0,
            'total_shared_cost' => 0,
            'party_bill_id' => $billId,
            'selected_sort_order' => 1,
        ]);
    }

    public function test_luu_va_doc_lai_lien_ket(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);

        $fresh = CarRentalComparison::with('partyBill')->find($comparison->id);

        $this->assertSame($bill->id, $fresh->party_bill_id);
        $this->assertSame(1, $fresh->selected_sort_order);
        $this->assertSame('Tiệc test', $fresh->partyBill->name);
    }

    public function test_xoa_bill_tiec_thi_lan_thue_xe_ve_null(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);

        $bill->delete();

        $this->assertNull($comparison->fresh()->party_bill_id);
        $this->assertNotNull($comparison->fresh(), 'lần thuê xe không được bị xóa theo');
    }

    public function test_extra_mang_co_so_huu(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);

        $extra = $bill->extras()->create([
            'name' => 'Chuyến Đà Lạt',
            'amount' => 1880000,
            'car_rental_comparison_id' => $comparison->id,
        ]);

        $this->assertSame($comparison->id, $extra->fresh()->carRentalComparison->id);
        $this->assertCount(1, $bill->fresh()->carRentals);
    }

    public function test_extra_thu_cong_khong_co_co_so_huu(): void
    {
        $bill = $this->bill();
        $extra = $bill->extras()->create(['name' => 'Bánh', 'amount' => 100000]);

        $this->assertNull($extra->fresh()->car_rental_comparison_id);
    }
}
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd BACKEND && php artisan test --filter=CarRentalPartyBillSchemaTest`
Expected: FAIL — cột `party_bill_id` chưa tồn tại.

- [ ] **Step 3: Viết migration**

`BACKEND/database/migrations/2026_08_21_000040_add_party_bill_link_to_car_rentals.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('car_rental_comparisons', function (Blueprint $table) {
            // Xóa bill tiệc thì lần thuê xe chỉ mất liên kết, không bị xóa theo.
            $table->foreignId('party_bill_id')
                ->nullable()
                ->after('created_by')
                ->constrained('party_bills')
                ->nullOnDelete();

            // Phương án thực tế thuê, trỏ vào car_rental_options.sort_order.
            // null = dùng phương án rẻ nhất.
            $table->unsignedInteger('selected_sort_order')->nullable()->after('party_bill_id');
        });

        Schema::table('party_bill_extras', function (Blueprint $table) {
            // Khác null = dòng do thuê xe sở hữu, màn bill tiệc không được sửa.
            $table->foreignId('car_rental_comparison_id')
                ->nullable()
                ->after('party_bill_id')
                ->constrained('car_rental_comparisons')
                ->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('party_bill_extras', function (Blueprint $table) {
            $table->dropForeign(['car_rental_comparison_id']);
            $table->dropColumn('car_rental_comparison_id');
        });

        Schema::table('car_rental_comparisons', function (Blueprint $table) {
            $table->dropForeign(['party_bill_id']);
            $table->dropColumn(['party_bill_id', 'selected_sort_order']);
        });
    }
};
```

- [ ] **Step 4: Cập nhật ba model**

`CarRentalComparison.php` — thêm vào `$fillable`:

```php
        'party_bill_id',
        'selected_sort_order',
```

và thêm quan hệ:

```php
    public function partyBill(): BelongsTo
    {
        return $this->belongsTo(PartyBill::class, 'party_bill_id');
    }
```

`PartyBillExtra.php` — thêm vào `$fillable`:

```php
        'car_rental_comparison_id',
```

và thêm quan hệ (nhớ `use Illuminate\Database\Eloquent\Relations\BelongsTo;` đã có sẵn):

```php
    public function carRentalComparison(): BelongsTo
    {
        return $this->belongsTo(CarRentalComparison::class, 'car_rental_comparison_id');
    }
```

`PartyBill.php` — thêm quan hệ:

```php
    public function carRentals(): HasMany
    {
        return $this->hasMany(CarRentalComparison::class, 'party_bill_id');
    }
```

- [ ] **Step 5: Chạy test**

Run: `cd BACKEND && php artisan test --filter=CarRentalPartyBillSchemaTest`
Expected: PASS, 4 tests.

- [ ] **Step 6: Chạy migration trên DB dev và chạy toàn bộ test**

```bash
cd BACKEND && php artisan migrate --force && php artisan test
```
Expected: migration DONE, toàn bộ test PASS.

- [ ] **Step 7: Commit**

```bash
git add BACKEND/database/migrations/2026_08_21_000040_add_party_bill_link_to_car_rentals.php \
        BACKEND/app/Models/CarRentalComparison.php \
        BACKEND/app/Models/PartyBillExtra.php \
        BACKEND/app/Models/PartyBill.php \
        BACKEND/tests/Feature/CarRentalPartyBillSchemaTest.php
git commit -m "feat(car-rental): cột liên kết bill tiệc và cờ sở hữu trên chi phí thêm"
```

---

### Task 4: Service đồng bộ liên kết

**Files:**
- Create: `BACKEND/app/Exceptions/PartyBillLockedException.php`
- Create: `BACKEND/app/Services/CarRentalPartyBillLink.php`
- Test: `BACKEND/tests/Feature/CarRentalPartyBillLinkTest.php`

**Interfaces:**
- Consumes: `PartyBillRecalculator::recalculate()`, `::isFullyPaid()` (Task 2); các cột và quan hệ (Task 3)
- Produces:
  - `App\Exceptions\PartyBillLockedException` với thuộc tính public `$billName`
  - `App\Services\CarRentalPartyBillLink::sync(CarRentalComparison $comparison, ?int $previousBillId): void`
  - `App\Services\CarRentalPartyBillLink::detach(CarRentalComparison $comparison): void`

- [ ] **Step 1: Viết test thất bại**

```php
<?php

namespace Tests\Feature;

use App\Exceptions\PartyBillLockedException;
use App\Models\CarRentalComparison;
use App\Models\PartyBill;
use App\Models\PartyBillExtra;
use App\Services\CarRentalPartyBillLink;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalPartyBillLinkTest extends TestCase
{
    use RefreshDatabase;

    private CarRentalPartyBillLink $link;

    protected function setUp(): void
    {
        parent::setUp();
        $this->link = app(CarRentalPartyBillLink::class);
    }

    private function bill(string $name = 'Tiệc test', int $base = 1000000): PartyBill
    {
        $bill = PartyBill::create([
            'date' => '2026-09-01',
            'name' => $name,
            'base_amount' => $base,
            'total_extra' => 0,
            'total_amount' => $base,
            'unit_price' => 0,
        ]);

        $bill->participants()->create([
            'name' => 'An', 'ratio_value' => 1, 'share_amount' => 0,
            'total_amount' => 0, 'paid_amount' => 0, 'food_amount' => 0, 'is_paid' => false,
        ]);
        $bill->participants()->create([
            'name' => 'Bình', 'ratio_value' => 1, 'share_amount' => 0,
            'total_amount' => 0, 'paid_amount' => 0, 'food_amount' => 0, 'is_paid' => false,
        ]);

        return $bill->fresh(['participants']);
    }

    private function comparison(?int $billId, ?int $selected = null): CarRentalComparison
    {
        $comparison = CarRentalComparison::create([
            'name' => 'Chuyến Đà Lạt',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'break_even_km' => 181,
            'saving_amount' => 1300000,
            'total_shared_cost' => 500000,
            'party_bill_id' => $billId,
            'selected_sort_order' => $selected,
        ]);

        $comparison->options()->create([
            'name' => 'Xe xăng', 'sort_order' => 0, 'rental_per_day' => 500000,
            'fuel_type' => 'petrol', 'consumption_per_100' => 7, 'fuel_unit_price' => 30000,
            'rental_cost' => 1000000, 'fuel_cost' => 1680000, 'total_cost' => 2680000,
            'trip_total_cost' => 3180000, 'cost_per_km' => 3350, 'is_cheapest' => false,
        ]);
        $comparison->options()->create([
            'name' => 'Xe điện', 'sort_order' => 1, 'rental_per_day' => 690000,
            'fuel_type' => 'electric', 'consumption_per_100' => 0, 'fuel_unit_price' => 0,
            'rental_cost' => 1380000, 'fuel_cost' => 0, 'total_cost' => 1380000,
            'trip_total_cost' => 1880000, 'cost_per_km' => 1725, 'is_cheapest' => true,
        ]);

        return $comparison->fresh(['options']);
    }

    public function test_gan_tao_extra_va_tinh_lai_tien(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);

        $this->link->sync($comparison, null);

        $extra = PartyBillExtra::where('car_rental_comparison_id', $comparison->id)->first();
        $this->assertNotNull($extra);
        $this->assertSame('Chuyến Đà Lạt', $extra->name);
        $this->assertSame(1880000, $extra->amount, 'mặc định lấy phương án rẻ nhất');

        $bill = $bill->fresh(['participants']);
        $this->assertSame(1880000, $bill->total_extra);
        $this->assertSame(2880000, $bill->total_amount);
        $this->assertSame(1440000, $bill->unit_price);
        $this->assertSame(1440000, $bill->participants->first()->share_amount);
    }

    public function test_chon_phuong_an_cu_the(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id, 0); // xe xăng

        $this->link->sync($comparison, null);

        $this->assertSame(
            3180000,
            PartyBillExtra::where('car_rental_comparison_id', $comparison->id)->first()->amount
        );
    }

    public function test_selected_sort_order_tro_vao_phuong_an_da_bi_xoa_thi_lui_ve_re_nhat(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id, 99);

        $this->link->sync($comparison, null);

        $this->assertSame(
            1880000,
            PartyBillExtra::where('car_rental_comparison_id', $comparison->id)->first()->amount
        );
        $this->assertNull($comparison->fresh()->selected_sort_order, 'con trỏ chết phải bị xóa');
    }

    public function test_ten_rong_thi_dung_ten_du_phong(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);
        $comparison->update(['name' => null]);

        $this->link->sync($comparison->fresh(['options']), null);

        $this->assertSame(
            "Chuyến xe #{$comparison->id}",
            PartyBillExtra::where('car_rental_comparison_id', $comparison->id)->first()->name
        );
    }

    public function test_doi_sang_bill_khac_thi_tinh_lai_ca_hai(): void
    {
        $billA = $this->bill('Tiệc A');
        $billB = $this->bill('Tiệc B');
        $comparison = $this->comparison($billA->id);
        $this->link->sync($comparison, null);

        $comparison->update(['party_bill_id' => $billB->id]);
        $this->link->sync($comparison->fresh(['options']), $billA->id);

        $this->assertSame(0, $billA->fresh()->total_extra, 'bill cũ phải được gỡ và tính lại');
        $this->assertSame(1880000, $billB->fresh()->total_extra);
        $this->assertSame(1, PartyBillExtra::count());
    }

    public function test_bo_gan_thi_xoa_extra_va_tinh_lai(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);
        $this->link->sync($comparison, null);

        $comparison->update(['party_bill_id' => null]);
        $this->link->sync($comparison->fresh(['options']), $bill->id);

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, $bill->fresh()->total_extra);
        $this->assertSame(500000, $bill->fresh()->unit_price);
    }

    public function test_detach_go_dong_extra(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);
        $this->link->sync($comparison, null);

        $this->link->detach($comparison->fresh(['options']));

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, $bill->fresh()->total_extra);
    }

    public function test_hai_lan_thue_xe_cung_gan_mot_bill(): void
    {
        $bill = $this->bill();
        $first = $this->comparison($bill->id);
        $second = $this->comparison($bill->id);

        $this->link->sync($first, null);
        $this->link->sync($second, null);

        $this->assertSame(2, PartyBillExtra::count());
        $this->assertSame(3760000, $bill->fresh()->total_extra);
    }

    public function test_bill_dich_da_thanh_toan_het_thi_nem_loi(): void
    {
        $bill = $this->bill();
        $bill->participants()->update(['is_paid' => true]);
        $comparison = $this->comparison($bill->id);

        $this->expectException(PartyBillLockedException::class);
        $this->link->sync($comparison, null);
    }

    public function test_bill_da_thanh_toan_het_thi_khong_go_duoc(): void
    {
        $bill = $this->bill();
        $comparison = $this->comparison($bill->id);
        $this->link->sync($comparison, null);

        $bill->participants()->update(['is_paid' => true]);

        $this->expectException(PartyBillLockedException::class);
        $this->link->detach($comparison->fresh(['options']));
    }

    public function test_khong_gan_bill_nao_thi_khong_lam_gi(): void
    {
        $comparison = $this->comparison(null);

        $this->link->sync($comparison, null);

        $this->assertSame(0, PartyBillExtra::count());
    }
}
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd BACKEND && php artisan test --filter=CarRentalPartyBillLinkTest`
Expected: FAIL — `Target class [App\Services\CarRentalPartyBillLink] does not exist.`

- [ ] **Step 3: Viết exception**

`BACKEND/app/Exceptions/PartyBillLockedException.php`:

```php
<?php

namespace App\Exceptions;

use Exception;

/**
 * Ném khi một thao tác sẽ làm đổi tiền của một bill tiệc mà mọi người tham
 * gia đều đã thanh toán. Giữ đúng bất biến sẵn có của PartyBillController.
 */
class PartyBillLockedException extends Exception
{
    public function __construct(public readonly string $billName)
    {
        parent::__construct(
            "Bill tiệc «{$billName}» đã thanh toán hết nên không sửa được. "
            .'Hãy bỏ đánh dấu thanh toán của ít nhất một người trước khi gắn hoặc gỡ chuyến xe.'
        );
    }
}
```

- [ ] **Step 4: Viết service**

`BACKEND/app/Services/CarRentalPartyBillLink.php`:

```php
<?php

namespace App\Services;

use App\Exceptions\PartyBillLockedException;
use App\Models\CarRentalComparison;
use App\Models\PartyBill;
use App\Models\PartyBillExtra;

/**
 * Giữ dòng chi phí thêm bên bill tiệc khớp với lần thuê xe đã gắn.
 *
 * Mọi nhánh chạm vào tiền đều đi qua lockGuard(): một bill đã thanh toán hết
 * thì không gắn cũng không gỡ được, vì cả hai đều làm đổi tiền của mọi người.
 */
class CarRentalPartyBillLink
{
    public function __construct(private PartyBillRecalculator $recalculator)
    {
    }

    public function sync(CarRentalComparison $comparison, ?int $previousBillId): void
    {
        $currentBillId = $comparison->party_bill_id;

        if ($previousBillId !== null && $previousBillId !== $currentBillId) {
            $this->removeFrom($previousBillId, $comparison->id);
        }

        if ($currentBillId === null) {
            return;
        }

        $bill = $this->lockGuard($currentBillId);

        PartyBillExtra::updateOrCreate(
            [
                'party_bill_id' => $bill->id,
                'car_rental_comparison_id' => $comparison->id,
            ],
            [
                'name' => $this->extraName($comparison),
                'amount' => $this->selectedAmount($comparison),
            ]
        );

        $this->recalculator->recalculate($bill);
    }

    public function detach(CarRentalComparison $comparison): void
    {
        if ($comparison->party_bill_id !== null) {
            $this->removeFrom($comparison->party_bill_id, $comparison->id);
        }
    }

    private function removeFrom(int $billId, int $comparisonId): void
    {
        $bill = $this->lockGuard($billId);

        PartyBillExtra::where('party_bill_id', $billId)
            ->where('car_rental_comparison_id', $comparisonId)
            ->delete();

        $this->recalculator->recalculate($bill);
    }

    /** @throws PartyBillLockedException */
    private function lockGuard(int $billId): PartyBill
    {
        $bill = PartyBill::with('participants')->findOrFail($billId);

        if ($this->recalculator->isFullyPaid($bill)) {
            throw new PartyBillLockedException($bill->name ?: "#{$bill->id}");
        }

        return $bill;
    }

    private function extraName(CarRentalComparison $comparison): string
    {
        $name = trim((string) $comparison->name);

        return $name !== '' ? $name : "Chuyến xe #{$comparison->id}";
    }

    /**
     * Tiền của phương án thực tế thuê.
     *
     * Không tìm được (chưa chọn, hoặc trỏ vào phương án đã bị xóa trong lần
     * sửa sau) thì lui về phương án rẻ nhất, đồng thời xóa con trỏ chết để dữ
     * liệu không giữ một tham chiếu không còn tồn tại.
     */
    private function selectedAmount(CarRentalComparison $comparison): int
    {
        $comparison->loadMissing('options');

        $selected = $comparison->selected_sort_order === null
            ? null
            : $comparison->options->firstWhere('sort_order', $comparison->selected_sort_order);

        if ($selected === null) {
            if ($comparison->selected_sort_order !== null) {
                $comparison->forceFill(['selected_sort_order' => null])->save();
            }

            $selected = $comparison->options->firstWhere('is_cheapest', true);
        }

        return (int) ($selected?->trip_total_cost ?? 0);
    }
}
```

- [ ] **Step 5: Chạy test**

Run: `cd BACKEND && php artisan test --filter=CarRentalPartyBillLinkTest`
Expected: PASS, 11 tests.

- [ ] **Step 6: Commit**

```bash
git add BACKEND/app/Exceptions/PartyBillLockedException.php \
        BACKEND/app/Services/CarRentalPartyBillLink.php \
        BACKEND/tests/Feature/CarRentalPartyBillLinkTest.php
git commit -m "feat(car-rental): service đồng bộ dòng chi phí thêm với bill tiệc"
```

---

### Task 5: Đấu vào hai controller

**Files:**
- Modify: `BACKEND/app/Http/Requests/StoreCarRentalComparisonRequest.php`
- Modify: `BACKEND/app/Http/Requests/UpdateCarRentalComparisonRequest.php`
- Modify: `BACKEND/app/Http/Controllers/Api/CarRentalController.php`
- Modify: `BACKEND/app/Http/Controllers/Api/PartyBillController.php`
- Test: `BACKEND/tests/Feature/CarRentalPartyBillApiTest.php`

**Interfaces:**
- Consumes: `CarRentalPartyBillLink::sync()`, `::detach()`, `PartyBillLockedException` (Task 4)
- Produces: API `/api/car-rentals` nhận thêm `party_bill_id` và `selected_sort_order`, trả về kèm quan hệ `partyBill`

- [ ] **Step 1: Viết test thất bại**

```php
<?php

namespace Tests\Feature;

use App\Models\PartyBill;
use App\Models\PartyBillExtra;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalPartyBillApiTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create(['name' => 'Người test', 'email' => 't@e.test', 'password' => 'secret123']);
    }

    private function bill(string $name = 'Tiệc test'): PartyBill
    {
        $bill = PartyBill::create([
            'date' => '2026-09-01', 'name' => $name, 'base_amount' => 1000000,
            'total_extra' => 0, 'total_amount' => 1000000, 'unit_price' => 0,
        ]);
        $bill->participants()->create([
            'name' => 'An', 'ratio_value' => 1, 'share_amount' => 0, 'total_amount' => 0,
            'paid_amount' => 0, 'food_amount' => 0, 'is_paid' => false,
        ]);

        return $bill->fresh(['participants']);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Chuyến Đà Lạt',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'options' => [
                [
                    'name' => 'Xe xăng', 'sort_order' => 0, 'rental_per_day' => 500000,
                    'fuel_type' => 'petrol', 'consumption_per_100' => 7, 'fuel_unit_price' => 30000,
                ],
                [
                    'name' => 'Xe điện', 'sort_order' => 1, 'rental_per_day' => 690000,
                    'fuel_type' => 'electric', 'consumption_per_100' => 0, 'fuel_unit_price' => 0,
                ],
            ],
        ], $overrides);
    }

    public function test_tao_lan_thue_xe_kem_gan_bill_tiec(): void
    {
        $bill = $this->bill();

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->assertStatus(201)
            ->assertJsonPath('party_bill_id', $bill->id)
            ->assertJsonPath('party_bill.name', 'Tiệc test');

        // Xe điện rẻ nhất: 1.380.000
        $this->assertSame(1380000, $bill->fresh()->total_extra);
        $this->assertSame(2380000, $bill->fresh()->total_amount);
    }

    public function test_khong_gan_bill_thi_khong_tao_extra(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('party_bill_id', null);

        $this->assertSame(0, PartyBillExtra::count());
    }

    public function test_sua_lan_thue_xe_thi_extra_cap_nhat(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->json('id');

        $this->actingAs($user)
            ->putJson("/api/car-rentals/{$id}", $this->payload([
                'party_bill_id' => $bill->id,
                'distance_km' => 400,
            ]))
            ->assertStatus(200);

        $this->assertSame(1380000, $bill->fresh()->total_extra, 'xe điện không đổi theo km');
        $this->assertSame(1, PartyBillExtra::count(), 'không được tạo dòng thứ hai');
    }

    public function test_doi_sang_bill_khac(): void
    {
        $billA = $this->bill('Tiệc A');
        $billB = $this->bill('Tiệc B');
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $billA->id]))
            ->json('id');

        $this->actingAs($user)
            ->putJson("/api/car-rentals/{$id}", $this->payload(['party_bill_id' => $billB->id]))
            ->assertStatus(200);

        $this->assertSame(0, $billA->fresh()->total_extra);
        $this->assertSame(1380000, $billB->fresh()->total_extra);
    }

    public function test_bo_gan(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->json('id');

        $this->actingAs($user)
            ->putJson("/api/car-rentals/{$id}", $this->payload(['party_bill_id' => null]))
            ->assertStatus(200);

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, $bill->fresh()->total_extra);
    }

    public function test_xoa_lan_thue_xe_thi_go_extra(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->json('id');

        $this->actingAs($user)->deleteJson("/api/car-rentals/{$id}")->assertStatus(200);

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, $bill->fresh()->total_extra);
    }

    public function test_bill_da_thanh_toan_het_thi_422_va_khong_doi_gi(): void
    {
        $bill = $this->bill();
        $bill->participants()->update(['is_paid' => true]);

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('party_bill_id');

        $this->assertSame(0, PartyBillExtra::count());
        $this->assertSame(0, \App\Models\CarRentalComparison::count(), 'phải rollback cả lần thuê xe');
    }

    public function test_party_bill_id_khong_ton_tai_bi_422(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => 99999]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('party_bill_id');
    }

    public function test_sua_bill_tiec_khong_xoa_dong_do_thue_xe_so_huu(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]));

        $this->actingAs($user)->putJson("/api/party-bills/{$bill->id}", [
            'date' => '2026-09-02',
            'name' => 'Tiệc đã sửa',
            'base_amount' => 2000000,
            'extras' => [['name' => 'Bánh', 'amount' => 100000]],
            'participants' => [['name' => 'An', 'ratio_value' => 1]],
        ])->assertStatus(200);

        $fresh = $bill->fresh(['extras']);
        $this->assertCount(2, $fresh->extras, 'dòng do thuê xe sở hữu phải còn');
        $this->assertSame(1480000, $fresh->total_extra, '1.380.000 xe + 100.000 bánh');
        $this->assertSame(3480000, $fresh->total_amount);
    }

    public function test_bo_qua_car_rental_comparison_id_client_bia_ra(): void
    {
        $bill = $this->bill();
        $user = $this->user();

        $this->actingAs($user)->putJson("/api/party-bills/{$bill->id}", [
            'date' => '2026-09-02',
            'name' => 'Tiệc',
            'base_amount' => 0,
            'extras' => [['name' => 'Giả mạo', 'amount' => 1, 'car_rental_comparison_id' => 123]],
            'participants' => [['name' => 'An', 'ratio_value' => 1]],
        ])->assertStatus(200);

        $this->assertSame(0, PartyBillExtra::whereNotNull('car_rental_comparison_id')->count());
    }

    public function test_xoa_bill_tiec_dang_duoc_gan(): void
    {
        $bill = $this->bill();
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload(['party_bill_id' => $bill->id]))
            ->json('id');

        $this->actingAs($user)->deleteJson("/api/party-bills/{$bill->id}")->assertStatus(200);

        $this->assertNull(\App\Models\CarRentalComparison::find($id)->party_bill_id);
    }
}
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd BACKEND && php artisan test --filter=CarRentalPartyBillApiTest`
Expected: FAIL — `party_bill_id` chưa được nhận.

- [ ] **Step 3: Thêm rule vào hai FormRequest**

Trong **cả hai** `StoreCarRentalComparisonRequest.php` và `UpdateCarRentalComparisonRequest.php`, thêm vào `rules()` ngay trước dòng `'options' => ...`:

```php
            'party_bill_id' => 'nullable|integer|exists:party_bills,id',
            'selected_sort_order' => 'nullable|integer|min:0',
```

và thêm vào `messages()`:

```php
            'party_bill_id.exists' => 'Bill tiệc được chọn không tồn tại.',
```

- [ ] **Step 4: Sửa `CarRentalController`**

Thêm import:

```php
use App\Exceptions\PartyBillLockedException;
use App\Services\CarRentalPartyBillLink;
use Illuminate\Validation\ValidationException;
```

Đổi constructor:

```php
    public function __construct(
        private CarRentalCalculator $calculator,
        private CarRentalPartyBillLink $link,
    ) {
    }
```

Đổi mọi chỗ eager load để kèm quan hệ mới — thay `['creator', 'options', 'sharedCosts']` thành:

```php
['creator', 'options', 'sharedCosts', 'partyBill']
```

Trong `store()` và `update()`, bọc lỗi khóa bill thành 422. Thay thân `store()`:

```php
    public function store(StoreCarRentalComparisonRequest $request): JsonResponse
    {
        $comparison = $this->persistWithLink(new CarRentalComparison(), $request, null);

        return response()->json($comparison->load(['creator', 'options', 'sharedCosts', 'partyBill']), 201);
    }
```

và `update()`:

```php
    public function update(UpdateCarRentalComparisonRequest $request, string $id): JsonResponse
    {
        $comparison = CarRentalComparison::findOrFail($id);
        $previousBillId = $comparison->party_bill_id;

        $comparison = $this->persistWithLink($comparison, $request, $previousBillId);

        return response()->json($comparison->load(['creator', 'options', 'sharedCosts', 'partyBill']));
    }
```

Thêm hàm bọc transaction. Đặt ngay trên `persist()`:

```php
    /**
     * Lưu lần thuê xe rồi đồng bộ bill tiệc TRONG CÙNG transaction.
     *
     * Bill tiệc bị khóa thì rollback sạch: lần thuê xe cũng không được lưu,
     * để hai bên không bao giờ lệch nhau.
     */
    private function persistWithLink(
        CarRentalComparison $comparison,
        Request $request,
        ?int $previousBillId
    ): CarRentalComparison {
        try {
            return DB::transaction(function () use ($comparison, $request, $previousBillId) {
                $saved = $this->persist($comparison, $request);
                $this->link->sync($saved, $previousBillId);

                return $saved->fresh();
            });
        } catch (PartyBillLockedException $e) {
            throw ValidationException::withMessages([
                'party_bill_id' => $e->getMessage(),
            ]);
        }
    }
```

Trong `persist()`, thêm hai trường vào `fill()`:

```php
            'party_bill_id' => $request->input('party_bill_id') ?: null,
            'selected_sort_order' => $request->input('selected_sort_order'),
```

Bỏ `DB::transaction` cũ ở `store()`/`update()` vì `persistWithLink()` đã bọc.

Đổi `destroy()`:

```php
    public function destroy(string $id): JsonResponse
    {
        $comparison = CarRentalComparison::with('options')->findOrFail($id);

        try {
            DB::transaction(function () use ($comparison) {
                // Gỡ TRƯỚC khi xóa: cascadeOnDelete không kích hoạt việc tính
                // lại tiền bill tiệc.
                $this->link->detach($comparison);
                $comparison->delete();
            });
        } catch (PartyBillLockedException $e) {
            throw ValidationException::withMessages(['party_bill_id' => $e->getMessage()]);
        }

        return response()->json(['message' => 'Đã xóa so sánh thuê xe.']);
    }
```

- [ ] **Step 5: Bảo vệ extras trong `PartyBillController::update()`**

Đổi dòng xóa extras:

```php
            // CHỈ xóa dòng người dùng tự nhập. Dòng do thuê xe sở hữu thuộc
            // quyền của màn Thuê xe, payload ở đây không hề biết đến nó.
            $partyBill->extras()->whereNull('car_rental_comparison_id')->delete();
            $partyBill->participants()->delete();
```

Và khi dựng lại extras, bỏ qua mọi `car_rental_comparison_id` client gửi lên:

```php
            foreach ($extrasData as $extra) {
                PartyBillExtra::create([
                    'party_bill_id' => $partyBill->id,
                    'name' => $extra['name'],
                    'amount' => (int) $extra['amount'],
                    // Cố ý KHÔNG đọc $extra['car_rental_comparison_id']:
                    // chỉ CarRentalPartyBillLink được tạo dòng sở hữu.
                    'car_rental_comparison_id' => null,
                ]);
            }
```

- [ ] **Step 6: Chạy toàn bộ test backend**

Run: `cd BACKEND && php artisan test`
Expected: PASS toàn bộ, gồm cả `PartyBillMoneyTest` (9 tests) **không sửa kỳ vọng**.

- [ ] **Step 7: Commit**

```bash
git add BACKEND/app/Http/Requests/ \
        BACKEND/app/Http/Controllers/Api/CarRentalController.php \
        BACKEND/app/Http/Controllers/Api/PartyBillController.php \
        BACKEND/tests/Feature/CarRentalPartyBillApiTest.php
git commit -m "feat(car-rental): API gắn bill tiệc, bảo vệ dòng chi phí thêm do thuê xe sở hữu"
```

---

### Task 6: Màn thuê xe — chọn bill tiệc và phương án

**Files:**
- Modify: `FRONTEND/src/screens/car-rental/CarRentalCalculator.jsx`
- Modify: `FRONTEND/src/screens/car-rental/CarRentalHistory.jsx`

**Interfaces:**
- Consumes: `partyBillsApi.getAll()` từ `../../services/api`; API `/api/car-rentals` nhận `party_bill_id`, `selected_sort_order` (Task 5)
- Produces: không có task nào phụ thuộc

- [ ] **Step 1: Thêm state và nạp danh sách bill tiệc**

Trong `CarRentalCalculator.jsx`, thêm `partyBillsApi` vào import từ `../../services/api`, rồi thêm state:

```jsx
  const [partyBills, setPartyBills] = useState([]);
```

và trong `DEFAULT_TRIP` thêm hai trường:

```jsx
  party_bill_id: "",
  selected_sort_order: "",
```

Nạp danh sách khi mount, chạy nền, lỗi thì bỏ qua:

```jsx
  useEffect(() => {
    let cancelled = false;

    partyBillsApi
      .getAll()
      .then((response) => {
        if (!cancelled) setPartyBills(response.data ?? []);
      })
      .catch(() => {
        /* không nạp được thì ẩn ô chọn, không chặn form */
      });

    return () => {
      cancelled = true;
    };
  }, []);
```

Trong `useEffect` nạp bản ghi cũ (`editing`), thêm hai trường vào `setTrip`:

```jsx
      party_bill_id: editing.party_bill_id ?? "",
      selected_sort_order:
        editing.selected_sort_order === null || editing.selected_sort_order === undefined
          ? ""
          : editing.selected_sort_order,
```

- [ ] **Step 2: Thêm hai ô chọn vào khối "Chuyến đi"**

Chèn ngay sau ô "Ghi chú" trong `<section>` Chuyến đi:

```jsx
          <div>
            <label className={labelClass}>Gắn vào bill tiệc</label>
            <select
              className={inputClass}
              value={trip.party_bill_id}
              onChange={(event) =>
                setTrip((prev) => ({ ...prev, party_bill_id: event.target.value }))
              }
            >
              <option value="">— Không gắn —</option>
              {partyBills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.name || `Bill #${bill.id}`}
                  {bill.date ? ` · ${new Date(bill.date).toLocaleDateString("vi-VN")}` : ""}
                </option>
              ))}
            </select>
          </div>

          {trip.party_bill_id !== "" && (
            <div>
              <label className={labelClass}>Xe thực tế thuê</label>
              <select
                className={inputClass}
                value={trip.selected_sort_order}
                onChange={(event) =>
                  setTrip((prev) => ({ ...prev, selected_sort_order: event.target.value }))
                }
              >
                <option value="">Phương án rẻ nhất</option>
                {options.map((option, index) => (
                  <option key={index} value={index}>
                    {option.name || `Phương án ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
```

- [ ] **Step 3: Thay khối chia đầu người khi đã gắn bill**

Thêm biến dẫn xuất ngay sau `hasKmLimit`:

```jsx
  const linkedBill = partyBills.find(
    (bill) => String(bill.id) === String(trip.party_bill_id)
  );
```

Trong khối "Tổng chi phí chuyến đi", thay điều kiện hiện `per_person_cost`. Khi đã gắn bill thì **không** hiện số tiền mỗi người nữa, thay bằng dòng dẫn sang bill tiệc — để không có hai con số "mỗi người" khác nhau trên hai màn hình:

```jsx
            {linkedBill ? (
              <div className="mt-3 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                Tiền xe được chia qua bill tiệc{" "}
                <a href={`/party-bills/${linkedBill.id}`} className="font-medium underline">
                  {linkedBill.name || `Bill #${linkedBill.id}`}
                </a>
                {result.total_shared_cost > 0 && (
                  <div className="text-blue-600 mt-1">
                    Số đẩy sang đã gồm chi phí chung ({formatCurrency(result.total_shared_cost)}) —
                    đừng gõ lại gửi xe / trạm thu phí thành dòng riêng bên bill tiệc.
                  </div>
                )}
              </div>
            ) : null}
```

Và bọc phần `{formatCurrency(option.per_person_cost)}/người` sẵn có bằng điều kiện `trip.people_count > 0 && !linkedBill`.

- [ ] **Step 4: Gửi hai trường mới trong payload**

Trong `handleSave`, thêm vào `payload`:

```jsx
      party_bill_id: trip.party_bill_id === "" ? null : Number(trip.party_bill_id),
      selected_sort_order:
        trip.selected_sort_order === "" ? null : Number(trip.selected_sort_order),
```

Và trong `catch`, hiển thị lỗi validate của backend (bill bị khóa trả về ở đây):

```jsx
    } catch (error) {
      const data = error?.response?.data;
      const detail =
        data?.errors?.party_bill_id?.[0] ||
        data?.message ||
        "Không lưu được. Thử lại giúp mình.";
      setMessage({ type: "error", text: detail });
    } finally {
```

- [ ] **Step 5: Hiện tên bill tiệc trong màn Lịch sử**

Trong `CarRentalHistory.jsx`, thêm vào khối meta (chỗ đang hiện "Điểm hòa vốn", "Người tạo"):

```jsx
                  {item.party_bill && (
                    <div>
                      Gắn với bill tiệc:{" "}
                      <a href={`/party-bills/${item.party_bill.id}`} className="text-blue-600 underline">
                        {item.party_bill.name || `Bill #${item.party_bill.id}`}
                      </a>
                    </div>
                  )}
```

- [ ] **Step 6: Lint và build**

```bash
cd FRONTEND && npm run lint && npx vite build --logLevel error
```
Expected: không có lỗi mới trong file `car-rental/`.

- [ ] **Step 7: Commit**

```bash
git add FRONTEND/src/screens/car-rental/CarRentalCalculator.jsx \
        FRONTEND/src/screens/car-rental/CarRentalHistory.jsx
git commit -m "feat(car-rental): chọn bill tiệc và phương án xe thực tế thuê"
```

---

### Task 7: Màn bill tiệc — hiện dòng chỉ đọc

**Files:**
- Modify: `FRONTEND/src/screens/party/EditPartyBill.jsx:96-102` (nạp form) và `:280-282` (payload)
- Modify: `FRONTEND/src/screens/party/PartyBillDetail.jsx:809-820` (hiển thị)

**Interfaces:**
- Consumes: trường `car_rental_comparison_id` trên mỗi phần tử `extras` (Task 3, Task 5)
- Produces: không có task nào phụ thuộc

- [ ] **Step 1: Lọc dòng sở hữu ra khỏi form sửa**

Trong `EditPartyBill.jsx`, thêm state:

```jsx
  const [lockedExtras, setLockedExtras] = useState([]);
```

Đổi đoạn nạp `extras` (dòng 96–102) thành:

```jsx
        extras: (bill.extras ?? [])
          .filter((ex) => !ex.car_rental_comparison_id)
          .map((ex) => ({ name: ex.name, amount: ex.amount || 0 })),
```

và ngay sau `setForm(...)`, thêm:

```jsx
      // Dòng do màn Thuê xe sở hữu: hiện chỉ đọc, KHÔNG đưa vào form và
      // KHÔNG gửi lên payload — backend tự giữ chúng.
      setLockedExtras((bill.extras ?? []).filter((ex) => ex.car_rental_comparison_id));
```

- [ ] **Step 2: Hiện các dòng chỉ đọc trong form**

Ngay dưới danh sách extras đang có trong JSX, chèn:

```jsx
                {lockedExtras.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {lockedExtras.map((extra) => (
                      <div
                        key={extra.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm"
                      >
                        <span className="text-gray-700">
                          🚗 {extra.name}
                          <span className="text-gray-500"> · đến từ màn Thuê xe</span>
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(extra.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="text-xs text-gray-500">
                      Sửa các khoản này ở màn Thuê xe. Chúng vẫn được tính vào tổng.
                    </div>
                  </div>
                )}
```

Nếu `formatCurrency` chưa được import trong file, thêm:

```jsx
import { formatCurrency } from "../../utils/formatters";
```

- [ ] **Step 3: Hiện icon và link trong màn chi tiết**

Trong `PartyBillDetail.jsx`, ở vòng lặp `bill.extras.map((ex) => ...)` (dòng 820), thêm icon và link cho dòng sở hữu. Thay phần hiển thị tên bằng:

```jsx
                  <span>
                    {ex.car_rental_comparison_id ? "🚗 " : ""}
                    {ex.name}
                    {ex.car_rental_comparison_id && (
                      <a href="/car-rental" className="ml-2 text-xs text-blue-600 underline">
                        xem chuyến xe
                      </a>
                    )}
                  </span>
```

- [ ] **Step 4: Kiểm chứng bằng mắt**

Chạy backend `php artisan serve` và frontend dev server, rồi:

1. Tạo một bill tiệc có 2 người, `base_amount` 1.000.000.
2. Vào `/car-rental`, nhập 800km/2 ngày, chọn bill tiệc vừa tạo, bấm **Lưu lại**.
3. Mở bill tiệc đó: phải thấy dòng `🚗 Chuyến ...` trong chi phí thêm, `total_amount` tăng đúng bằng tổng chuyến, và tiền mỗi người tăng theo.
4. Bấm **Sửa** bill tiệc, đổi `base_amount`, lưu. Dòng 🚗 **phải còn nguyên** và tổng vẫn gồm nó.
5. Về `/car-rental`, mở lại bản ghi, chọn "— Không gắn —", lưu. Dòng 🚗 biến mất khỏi bill tiệc, tiền mỗi người giảm lại.
6. Đánh dấu tất cả người trong bill tiệc là đã thanh toán, rồi thử gắn lại chuyến xe: phải thấy thông báo lỗi đỏ nói bill đã thanh toán hết.

- [ ] **Step 5: Lint và build**

```bash
cd FRONTEND && npm run lint && npx vite build --logLevel error
```
Expected: không có lỗi mới trong `screens/party/`.

- [ ] **Step 6: Commit**

```bash
git add FRONTEND/src/screens/party/EditPartyBill.jsx \
        FRONTEND/src/screens/party/PartyBillDetail.jsx
git commit -m "feat(party-bill): hiện dòng chi phí thêm do thuê xe sở hữu dạng chỉ đọc"
```

---

## Bản đồ đối chiếu spec → task

| Mục spec | Task |
|---|---|
| 2. Quả mìn `extras()->delete()` | 5 (Step 5) |
| 3. Mô hình dữ liệu | 3 |
| 4. `PartyBillRecalculator` | 1 (khóa hành vi), 2 (tách) |
| 5. `CarRentalPartyBillLink`, số tiền, tên dòng, chốt chặn khóa | 4 |
| 6. Thay đổi `PartyBillController` | 2 (store/update dùng recalculator), 5 (bảo vệ extras) |
| 6b. Hợp đồng API, transaction, eager load | 5 |
| 7. Giao diện màn thuê xe | 6 |
| 7. Giao diện màn bill tiệc | 7 |
| 8. Test khóa hành vi | 1 |
| 8. Test `PartyBillRecalculator` | 2 |
| 8. Test `CarRentalPartyBillLink` | 4 (mức service), 5 (mức API) |
| 9. Rủi ro refactor code tiền | 1 + 2, kỳ vọng không đổi |
