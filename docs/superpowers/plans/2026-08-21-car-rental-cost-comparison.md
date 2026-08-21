# So sánh chi phí thuê xe — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Màn hình so sánh chi phí thuê N phương án xe cho một chuyến đi, chỉ ra phương án rẻ nhất và điểm hòa vốn theo quãng đường, có lưu lịch sử dùng chung cả CLB.

**Architecture:** Frontend tính preview tức thì bằng module JS thuần (`carRentalCost.js`), không gọi API. Khi bấm Lưu, frontend chỉ gửi input; backend tính lại từ đầu bằng `CarRentalCalculator` service rồi lưu snapshot kết quả của chính nó vào 2 bảng `car_rental_comparisons` + `car_rental_options`. Công thức tồn tại ở 2 ngôn ngữ, được ghim bằng 2 bộ test dùng chung một bộ số kỳ vọng.

**Tech Stack:** Laravel 11 (PHP 8.2+), PHPUnit + SQLite in-memory, React 19 + React Router 7, Tailwind 3, Axios, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-21-car-rental-cost-comparison-design.md`

## Global Constraints

- Mọi giá trị tiền là **số nguyên đồng**. Không dùng float cho tiền.
- Làm tròn bằng `round()` (PHP) và `Math.round()` (JS). Hai hàm này khớp nhau với mọi giá trị **không âm** — toàn bộ giá trị trong chức năng này đều không âm.
- Tên trường dùng **snake_case ở cả PHP lẫn JS**. Đây là định dạng đi trên dây (wire format), giữ giống nhau để hai bộ test dùng chung bộ số kỳ vọng và frontend gửi thẳng input lên API không cần map lại.
- Backend chỉ chặn `middleware('auth')`, **không kiểm tra quyền ở tầng server** — đúng theo cả 14 controller hiện có. Quyền gác ở frontend.
- **TUYỆT ĐỐI KHÔNG sửa và không commit `FRONTEND/vite.config.js`** — đây là file cấu hình proxy dev cục bộ. Cấu hình Vitest đặt ở `FRONTEND/vitest.config.js` riêng.
- **Cẩn thận trùng tên `CarRentalCalculator`**: có HAI thứ khác nhau mang tên này — service PHP `BACKEND/app/Services/CarRentalCalculator.php` (Task 1) và component React `FRONTEND/src/screens/car-rental/CarRentalCalculator.jsx` (Task 7). Luôn đọc đường dẫn đầy đủ, đừng sửa nhầm file.
- Commit thẳng lên `main`, không tạo feature branch.
- Toàn bộ chuỗi hiển thị cho người dùng viết bằng **tiếng Việt có dấu**.
- Lệnh chạy test: backend `cd BACKEND && php artisan test`, frontend `cd FRONTEND && npm test`.

---

### Task 1: Service tính chi phí phía backend

Đây là trái tim của chức năng và không phụ thuộc DB hay HTTP, nên làm đầu tiên và test kỹ nhất.

**Files:**
- Create: `BACKEND/app/Services/CarRentalCalculator.php` (thư mục `app/Services` chưa tồn tại, tạo mới)
- Test: `BACKEND/tests/Unit/CarRentalCalculatorTest.php`

**Interfaces:**
- Consumes: không có (task đầu tiên)
- Produces: `App\Services\CarRentalCalculator::calculate(array $input): array`
  - `$input`: `['days' => int, 'distance_km' => int, 'people_count' => int, 'options' => array<int, array>]`
  - Mỗi phần tử `options` đầu vào: `name`, `sort_order`, `rental_per_day`, `fuel_type`, `consumption_per_100`, `fuel_unit_price`, `extra_fixed_cost`, `km_limit_per_day`, `over_km_fee`
  - Trả về: `['break_even_km' => ?int, 'saving_amount' => int, 'options' => array<int, array>]`, mỗi option có đủ trường đầu vào **cộng** `rental_cost`, `fuel_cost`, `over_km_cost`, `total_cost`, `cost_per_km`, `per_person_cost`, `is_cheapest`

- [ ] **Step 1: Viết test thất bại**

Tạo `BACKEND/tests/Unit/CarRentalCalculatorTest.php`. Kế thừa `PHPUnit\Framework\TestCase` (không phải `Tests\TestCase`) vì service thuần, không cần Laravel container — giống `tests/Unit/ExampleTest.php` sẵn có.

```php
<?php

namespace Tests\Unit;

use App\Services\CarRentalCalculator;
use PHPUnit\Framework\TestCase;

class CarRentalCalculatorTest extends TestCase
{
    private CarRentalCalculator $calculator;

    protected function setUp(): void
    {
        parent::setUp();
        $this->calculator = new CarRentalCalculator();
    }

    private function petrol(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Xe xăng',
            'sort_order' => 0,
            'rental_per_day' => 500000,
            'fuel_type' => 'petrol',
            'consumption_per_100' => 7,
            'fuel_unit_price' => 30000,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
        ], $overrides);
    }

    private function electric(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Xe điện',
            'sort_order' => 1,
            'rental_per_day' => 690000,
            'fuel_type' => 'electric',
            'consumption_per_100' => 0,
            'fuel_unit_price' => 0,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
        ], $overrides);
    }

    private function trip(array $options, array $overrides = []): array
    {
        return array_merge([
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'options' => $options,
        ], $overrides);
    }

    public function test_bai_toan_mau_800km_2_ngay(): void
    {
        $result = $this->calculator->calculate(
            $this->trip([$this->petrol(), $this->electric()])
        );

        [$petrol, $electric] = $result['options'];

        $this->assertSame(1000000, $petrol['rental_cost']);
        $this->assertSame(1680000, $petrol['fuel_cost']);
        $this->assertSame(0, $petrol['over_km_cost']);
        $this->assertSame(2680000, $petrol['total_cost']);
        $this->assertSame(3350, $petrol['cost_per_km']);
        $this->assertFalse($petrol['is_cheapest']);

        $this->assertSame(1380000, $electric['rental_cost']);
        $this->assertSame(0, $electric['fuel_cost']);
        $this->assertSame(1380000, $electric['total_cost']);
        $this->assertSame(1725, $electric['cost_per_km']);
        $this->assertTrue($electric['is_cheapest']);

        $this->assertSame(1300000, $result['saving_amount']);
        $this->assertSame(181, $result['break_even_km']);
    }

    public function test_xe_dien_sac_tra_phi(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(),
            $this->electric(['consumption_per_100' => 18, 'fuel_unit_price' => 3858]),
        ]));

        $this->assertSame(555552, $result['options'][1]['fuel_cost']);
        $this->assertSame(1935552, $result['options'][1]['total_cost']);
        $this->assertTrue($result['options'][1]['is_cheapest']);
        $this->assertSame(744448, $result['saving_amount']);
    }

    public function test_vuot_gioi_han_km_ap_cho_ca_hai_phuong_an(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(['km_limit_per_day' => 300, 'over_km_fee' => 4000]),
            $this->electric(['km_limit_per_day' => 300, 'over_km_fee' => 4000]),
        ]));

        $this->assertSame(800000, $result['options'][0]['over_km_cost']);
        $this->assertSame(800000, $result['options'][1]['over_km_cost']);
        $this->assertSame(3480000, $result['options'][0]['total_cost']);
        $this->assertSame(2180000, $result['options'][1]['total_cost']);
    }

    public function test_khong_vuot_khi_gioi_han_du_lon(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(['km_limit_per_day' => 500, 'over_km_fee' => 4000]),
            $this->electric(),
        ]));

        $this->assertSame(0, $result['options'][0]['over_km_cost']);
    }

    public function test_chi_phi_co_dinh_khac_cong_vao_tong(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(['extra_fixed_cost' => 200000]),
            $this->electric(),
        ]));

        $this->assertSame(2880000, $result['options'][0]['total_cost']);
    }

    public function test_fuel_type_none_bo_qua_tieu_hao(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(['fuel_type' => 'none']),
            $this->electric(),
        ]));

        $this->assertSame(0, $result['options'][0]['fuel_cost']);
        $this->assertSame(1000000, $result['options'][0]['total_cost']);
    }

    public function test_quang_duong_bang_0_khong_chia_cho_0(): void
    {
        $result = $this->calculator->calculate($this->trip(
            [$this->petrol(), $this->electric()],
            ['distance_km' => 0]
        ));

        $this->assertSame(0, $result['options'][0]['cost_per_km']);
        $this->assertSame(0, $result['options'][0]['fuel_cost']);
    }

    public function test_chia_dau_nguoi(): void
    {
        $result = $this->calculator->calculate($this->trip(
            [$this->petrol(), $this->electric()],
            ['people_count' => 8]
        ));

        $this->assertSame(335000, $result['options'][0]['per_person_cost']);
        $this->assertSame(172500, $result['options'][1]['per_person_cost']);
    }

    public function test_so_nguoi_bang_0_khong_chia_cho_0(): void
    {
        $result = $this->calculator->calculate($this->trip([$this->petrol(), $this->electric()]));

        $this->assertSame(0, $result['options'][0]['per_person_cost']);
    }

    public function test_ba_phuong_an_khong_co_diem_hoa_von(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(),
            $this->electric(),
            $this->petrol(['name' => 'Xe xăng nhà B', 'sort_order' => 2, 'rental_per_day' => 450000]),
        ]));

        $this->assertNull($result['break_even_km']);
        $this->assertTrue($result['options'][1]['is_cheapest']);
    }

    public function test_hai_phuong_an_cung_muc_tieu_hao_khong_co_nghiem(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(),
            $this->petrol(['name' => 'Xe xăng nhà B', 'sort_order' => 1, 'rental_per_day' => 450000]),
        ]));

        $this->assertNull($result['break_even_km']);
        $this->assertTrue($result['options'][1]['is_cheapest']);
    }

    public function test_diem_cat_am_tra_ve_null(): void
    {
        // Xe điện vừa rẻ tiền thuê vừa rẻ nhiên liệu: rẻ hơn ở mọi quãng đường.
        $result = $this->calculator->calculate($this->trip([
            $this->petrol(),
            $this->electric(['rental_per_day' => 400000]),
        ]));

        $this->assertNull($result['break_even_km']);
    }

    public function test_hoa_tong_tien_thi_sort_order_nho_hon_thang(): void
    {
        $result = $this->calculator->calculate($this->trip([
            $this->electric(['name' => 'Điện A', 'sort_order' => 0]),
            $this->electric(['name' => 'Điện B', 'sort_order' => 1]),
        ]));

        $this->assertTrue($result['options'][0]['is_cheapest']);
        $this->assertFalse($result['options'][1]['is_cheapest']);
        $this->assertSame(0, $result['saving_amount']);
    }
}
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd BACKEND && php artisan test --filter=CarRentalCalculatorTest`
Expected: FAIL — `Class "App\Services\CarRentalCalculator" not found`

- [ ] **Step 3: Viết implementation tối thiểu**

Tạo `BACKEND/app/Services/CarRentalCalculator.php`:

```php
<?php

namespace App\Services;

class CarRentalCalculator
{
    /**
     * Sai số cho phép khi so sánh hai chi phí biến đổi (đ/km) dạng float.
     */
    private const EPSILON = 0.000001;

    public function calculate(array $input): array
    {
        $days = (int) ($input['days'] ?? 0);
        $distanceKm = (int) ($input['distance_km'] ?? 0);
        $peopleCount = (int) ($input['people_count'] ?? 0);

        $options = [];
        foreach (array_values($input['options'] ?? []) as $index => $raw) {
            $options[] = $this->calculateOption($raw, $index, $days, $distanceKm, $peopleCount);
        }

        $options = $this->markCheapest($options);

        return [
            'break_even_km' => $this->breakEvenKm($options, $days),
            'saving_amount' => $this->savingAmount($options),
            'options' => $options,
        ];
    }

    private function calculateOption(
        array $raw,
        int $index,
        int $days,
        int $distanceKm,
        int $peopleCount
    ): array {
        $fuelType = $raw['fuel_type'] ?? 'none';
        $rentalPerDay = (int) ($raw['rental_per_day'] ?? 0);
        $consumption = $fuelType === 'none' ? 0.0 : (float) ($raw['consumption_per_100'] ?? 0);
        $fuelUnitPrice = (int) ($raw['fuel_unit_price'] ?? 0);
        $extraFixedCost = (int) ($raw['extra_fixed_cost'] ?? 0);
        $overKmFee = (int) ($raw['over_km_fee'] ?? 0);

        $kmLimitPerDay = ($raw['km_limit_per_day'] ?? null) !== null
            ? (int) $raw['km_limit_per_day']
            : null;

        $rentalCost = $rentalPerDay * $days;
        $fuelCost = (int) round($distanceKm * $consumption / 100 * $fuelUnitPrice);

        $overKm = $kmLimitPerDay === null
            ? 0
            : max(0, $distanceKm - $kmLimitPerDay * $days);
        $overKmCost = $overKm * $overKmFee;

        $totalCost = $rentalCost + $fuelCost + $overKmCost + $extraFixedCost;

        return [
            'name' => (string) ($raw['name'] ?? ''),
            'sort_order' => (int) ($raw['sort_order'] ?? $index),
            'rental_per_day' => $rentalPerDay,
            'fuel_type' => $fuelType,
            'consumption_per_100' => $consumption,
            'fuel_unit_price' => $fuelUnitPrice,
            'extra_fixed_cost' => $extraFixedCost,
            'km_limit_per_day' => $kmLimitPerDay,
            'over_km_fee' => $overKmFee,
            'rental_cost' => $rentalCost,
            'fuel_cost' => $fuelCost,
            'over_km_cost' => $overKmCost,
            'total_cost' => $totalCost,
            'cost_per_km' => $distanceKm > 0 ? (int) round($totalCost / $distanceKm) : 0,
            'per_person_cost' => $peopleCount > 0 ? (int) round($totalCost / $peopleCount) : 0,
            'is_cheapest' => false,
        ];
    }

    /**
     * Đánh dấu phương án tổng tiền nhỏ nhất. Hòa thì sort_order nhỏ hơn thắng.
     */
    private function markCheapest(array $options): array
    {
        if ($options === []) {
            return $options;
        }

        $winner = 0;
        foreach ($options as $i => $option) {
            $best = $options[$winner];
            $cheaper = $option['total_cost'] < $best['total_cost'];
            $tieButEarlier = $option['total_cost'] === $best['total_cost']
                && $option['sort_order'] < $best['sort_order'];

            if ($cheaper || $tieButEarlier) {
                $winner = $i;
            }
        }

        $options[$winner]['is_cheapest'] = true;

        return $options;
    }

    private function savingAmount(array $options): int
    {
        if (count($options) < 2) {
            return 0;
        }

        $totals = array_column($options, 'total_cost');
        sort($totals);

        return $totals[1] - $totals[0];
    }

    /**
     * Quãng đường mà hai phương án hòa chi phí.
     *
     * Chỉ tính khi có đúng 2 phương án và CỐ Ý bỏ qua phí vượt km, vì phí vượt
     * là hàm bậc thang làm bài toán mất tính tuyến tính. UI phải ghi rõ
     * "(chưa tính phí vượt km)" khi người dùng có bật giới hạn km.
     */
    private function breakEvenKm(array $options, int $days): ?int
    {
        if (count($options) !== 2) {
            return null;
        }

        [$a, $b] = $options;

        $fixedA = $a['rental_per_day'] * $days + $a['extra_fixed_cost'];
        $fixedB = $b['rental_per_day'] * $days + $b['extra_fixed_cost'];
        $varA = $a['consumption_per_100'] / 100 * $a['fuel_unit_price'];
        $varB = $b['consumption_per_100'] / 100 * $b['fuel_unit_price'];

        if (abs($varA - $varB) < self::EPSILON) {
            return null;
        }

        $distance = ($fixedB - $fixedA) / ($varA - $varB);

        return $distance > 0 ? (int) round($distance) : null;
    }
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó pass**

Run: `cd BACKEND && php artisan test --filter=CarRentalCalculatorTest`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add BACKEND/app/Services/CarRentalCalculator.php BACKEND/tests/Unit/CarRentalCalculatorTest.php
git commit -m "feat(car-rental): service tính chi phí thuê xe kèm điểm hòa vốn"
```

---

### Task 2: Bảng dữ liệu và models

**Files:**
- Create: `BACKEND/database/migrations/2026_08_21_000000_create_car_rental_comparisons_table.php`
- Create: `BACKEND/database/migrations/2026_08_21_000010_create_car_rental_options_table.php`
- Create: `BACKEND/app/Models/CarRentalComparison.php`
- Create: `BACKEND/app/Models/CarRentalOption.php`
- Test: `BACKEND/tests/Feature/CarRentalModelTest.php`

**Interfaces:**
- Consumes: không có
- Produces:
  - `App\Models\CarRentalComparison` với quan hệ `options(): HasMany` (đã `orderBy('sort_order')`) và `creator(): BelongsTo`
  - `App\Models\CarRentalOption` với quan hệ `comparison(): BelongsTo`
  - Bảng `car_rental_comparisons`, `car_rental_options` (khóa ngoại `car_rental_comparison_id`, `cascadeOnDelete`)

- [ ] **Step 1: Viết test thất bại**

Tạo `BACKEND/tests/Feature/CarRentalModelTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\CarRentalComparison;
use App\Models\CarRentalOption;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalModelTest extends TestCase
{
    use RefreshDatabase;

    private function makeComparison(): CarRentalComparison
    {
        return CarRentalComparison::create([
            'name' => 'Chuyến Đà Lạt',
            'date' => '2026-09-01',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 8,
            'note' => null,
            'break_even_km' => 181,
            'saving_amount' => 1300000,
            'created_by' => null,
        ]);
    }

    public function test_luu_va_doc_lai_comparison_kem_options(): void
    {
        $comparison = $this->makeComparison();

        $comparison->options()->create([
            'name' => 'Xe điện',
            'sort_order' => 1,
            'rental_per_day' => 690000,
            'fuel_type' => 'electric',
            'consumption_per_100' => 0,
            'fuel_unit_price' => 0,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
            'rental_cost' => 1380000,
            'fuel_cost' => 0,
            'over_km_cost' => 0,
            'total_cost' => 1380000,
            'cost_per_km' => 1725,
            'per_person_cost' => 172500,
            'is_cheapest' => true,
        ]);

        $comparison->options()->create([
            'name' => 'Xe xăng',
            'sort_order' => 0,
            'rental_per_day' => 500000,
            'fuel_type' => 'petrol',
            'consumption_per_100' => 7,
            'fuel_unit_price' => 30000,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
            'rental_cost' => 1000000,
            'fuel_cost' => 1680000,
            'over_km_cost' => 0,
            'total_cost' => 2680000,
            'cost_per_km' => 3350,
            'per_person_cost' => 335000,
            'is_cheapest' => false,
        ]);

        $fresh = CarRentalComparison::with('options')->find($comparison->id);

        $this->assertCount(2, $fresh->options);
        $this->assertSame('Xe xăng', $fresh->options[0]->name, 'options phải sắp theo sort_order');
        $this->assertTrue($fresh->options[1]->is_cheapest);
        $this->assertSame(7.0, $fresh->options[0]->consumption_per_100);
        $this->assertNull($fresh->options[0]->km_limit_per_day);
    }

    public function test_xoa_comparison_thi_xoa_luon_options(): void
    {
        $comparison = $this->makeComparison();
        $comparison->options()->create([
            'name' => 'Xe xăng',
            'sort_order' => 0,
            'rental_per_day' => 500000,
            'fuel_type' => 'petrol',
            'consumption_per_100' => 7,
            'fuel_unit_price' => 30000,
            'rental_cost' => 1000000,
            'fuel_cost' => 1680000,
            'total_cost' => 2680000,
            'cost_per_km' => 3350,
        ]);

        $comparison->delete();

        $this->assertSame(0, CarRentalOption::count());
    }
}
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd BACKEND && php artisan test --filter=CarRentalModelTest`
Expected: FAIL — `Class "App\Models\CarRentalComparison" not found`

- [ ] **Step 3: Viết migrations và models**

`BACKEND/database/migrations/2026_08_21_000000_create_car_rental_comparisons_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('car_rental_comparisons', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->date('date')->nullable();
            $table->unsignedInteger('days')->default(1); // Số ngày thuê
            $table->unsignedInteger('distance_km')->default(0); // Tổng km cả đi lẫn về
            $table->unsignedInteger('people_count')->default(0); // 0 = không chia đầu người
            $table->text('note')->nullable();
            $table->unsignedInteger('break_even_km')->nullable(); // null khi không có nghiệm
            $table->unsignedBigInteger('saving_amount')->default(0); // rẻ nhì - rẻ nhất
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('car_rental_comparisons');
    }
};
```

`BACKEND/database/migrations/2026_08_21_000010_create_car_rental_options_table.php`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('car_rental_options', function (Blueprint $table) {
            $table->id();
            $table->foreignId('car_rental_comparison_id')
                ->constrained('car_rental_comparisons')
                ->cascadeOnDelete();

            // Đầu vào
            $table->string('name');
            $table->unsignedInteger('sort_order')->default(0);
            $table->unsignedBigInteger('rental_per_day')->default(0);
            $table->string('fuel_type', 20)->default('none'); // petrol | electric | none
            $table->decimal('consumption_per_100', 8, 2)->default(0); // L/100km hoặc kWh/100km
            $table->unsignedInteger('fuel_unit_price')->default(0); // đ/L hoặc đ/kWh, 0 = miễn phí
            $table->unsignedBigInteger('extra_fixed_cost')->default(0);
            $table->unsignedInteger('km_limit_per_day')->nullable(); // null = không giới hạn
            $table->unsignedInteger('over_km_fee')->default(0);

            // Kết quả backend tính, lưu snapshot
            $table->unsignedBigInteger('rental_cost')->default(0);
            $table->unsignedBigInteger('fuel_cost')->default(0);
            $table->unsignedBigInteger('over_km_cost')->default(0);
            $table->unsignedBigInteger('total_cost')->default(0);
            $table->unsignedInteger('cost_per_km')->default(0);
            $table->unsignedInteger('per_person_cost')->default(0);
            $table->boolean('is_cheapest')->default(false);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('car_rental_options');
    }
};
```

`BACKEND/app/Models/CarRentalComparison.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CarRentalComparison extends Model
{
    protected $fillable = [
        'name',
        'date',
        'days',
        'distance_km',
        'people_count',
        'note',
        'break_even_km',
        'saving_amount',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function options(): HasMany
    {
        return $this->hasMany(CarRentalOption::class)->orderBy('sort_order');
    }
}
```

`BACKEND/app/Models/CarRentalOption.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CarRentalOption extends Model
{
    protected $fillable = [
        'car_rental_comparison_id',
        'name',
        'sort_order',
        'rental_per_day',
        'fuel_type',
        'consumption_per_100',
        'fuel_unit_price',
        'extra_fixed_cost',
        'km_limit_per_day',
        'over_km_fee',
        'rental_cost',
        'fuel_cost',
        'over_km_cost',
        'total_cost',
        'cost_per_km',
        'per_person_cost',
        'is_cheapest',
    ];

    protected function casts(): array
    {
        return [
            'consumption_per_100' => 'float',
            'is_cheapest' => 'boolean',
        ];
    }

    public function comparison(): BelongsTo
    {
        return $this->belongsTo(CarRentalComparison::class, 'car_rental_comparison_id');
    }
}
```

- [ ] **Step 4: Chạy test để chắc chắn nó pass**

Run: `cd BACKEND && php artisan test --filter=CarRentalModelTest`
Expected: PASS, 2 tests

- [ ] **Step 5: Commit**

```bash
git add BACKEND/database/migrations/2026_08_21_000000_create_car_rental_comparisons_table.php \
        BACKEND/database/migrations/2026_08_21_000010_create_car_rental_options_table.php \
        BACKEND/app/Models/CarRentalComparison.php \
        BACKEND/app/Models/CarRentalOption.php \
        BACKEND/tests/Feature/CarRentalModelTest.php
git commit -m "feat(car-rental): bảng car_rental_comparisons + car_rental_options và models"
```

---

### Task 3: API CRUD

**Files:**
- Create: `BACKEND/app/Http/Requests/StoreCarRentalComparisonRequest.php`
- Create: `BACKEND/app/Http/Requests/UpdateCarRentalComparisonRequest.php`
- Create: `BACKEND/app/Http/Controllers/Api/CarRentalController.php`
- Modify: `BACKEND/routes/api.php` (thêm `use` ở đầu file, thêm route vào trong nhóm `Route::middleware('auth')`, đặt ngay sau dòng `Route::apiResource('party-bills', ...)`)
- Test: `BACKEND/tests/Feature/CarRentalControllerTest.php`

**Interfaces:**
- Consumes: `App\Services\CarRentalCalculator::calculate()` (Task 1); `App\Models\CarRentalComparison`, `App\Models\CarRentalOption` (Task 2)
- Produces: 5 endpoint `GET|POST /api/car-rentals`, `GET|PUT|DELETE /api/car-rentals/{id}`. Response của `store`/`show`/`update` là object comparison kèm `options` và `creator`.

- [ ] **Step 1: Viết test thất bại**

Tạo `BACKEND/tests/Feature/CarRentalControllerTest.php`:

```php
<?php

namespace Tests\Feature;

use App\Models\CarRentalComparison;
use App\Models\CarRentalOption;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class CarRentalControllerTest extends TestCase
{
    use RefreshDatabase;

    private function user(): User
    {
        return User::create([
            'name' => 'Người test',
            'email' => 'test@example.com',
            'password' => 'secret123', // cast 'hashed' của User tự băm
        ]);
    }

    private function payload(array $overrides = []): array
    {
        return array_merge([
            'name' => 'Chuyến Đà Lạt',
            'date' => '2026-09-01',
            'days' => 2,
            'distance_km' => 800,
            'people_count' => 0,
            'note' => null,
            'options' => [
                [
                    'name' => 'Xe xăng',
                    'sort_order' => 0,
                    'rental_per_day' => 500000,
                    'fuel_type' => 'petrol',
                    'consumption_per_100' => 7,
                    'fuel_unit_price' => 30000,
                    'extra_fixed_cost' => 0,
                    'km_limit_per_day' => null,
                    'over_km_fee' => 0,
                ],
                [
                    'name' => 'Xe điện',
                    'sort_order' => 1,
                    'rental_per_day' => 690000,
                    'fuel_type' => 'electric',
                    'consumption_per_100' => 0,
                    'fuel_unit_price' => 0,
                    'extra_fixed_cost' => 0,
                    'km_limit_per_day' => null,
                    'over_km_fee' => 0,
                ],
            ],
        ], $overrides);
    }

    public function test_chua_dang_nhap_bi_401(): void
    {
        $this->getJson('/api/car-rentals')->assertStatus(401);
    }

    public function test_tao_moi_va_backend_tu_tinh(): void
    {
        $response = $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload());

        $response->assertStatus(201)
            ->assertJsonPath('break_even_km', 181)
            ->assertJsonPath('saving_amount', 1300000)
            ->assertJsonPath('options.0.total_cost', 2680000)
            ->assertJsonPath('options.0.is_cheapest', false)
            ->assertJsonPath('options.1.total_cost', 1380000)
            ->assertJsonPath('options.1.is_cheapest', true);

        $this->assertSame(1, CarRentalComparison::count());
        $this->assertSame(2, CarRentalOption::count());
    }

    public function test_bo_qua_ket_qua_client_gui_len(): void
    {
        $payload = $this->payload();
        $payload['break_even_km'] = 99999;
        $payload['saving_amount'] = 1;
        $payload['options'][0]['total_cost'] = 1;
        $payload['options'][0]['cost_per_km'] = 1;
        $payload['options'][0]['is_cheapest'] = true;

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $payload)
            ->assertStatus(201)
            ->assertJsonPath('break_even_km', 181)
            ->assertJsonPath('saving_amount', 1300000)
            ->assertJsonPath('options.0.total_cost', 2680000)
            ->assertJsonPath('options.0.cost_per_km', 3350)
            ->assertJsonPath('options.0.is_cheapest', false);
    }

    public function test_gan_created_by_cho_nguoi_dang_dang_nhap(): void
    {
        $user = $this->user();

        $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload())
            ->assertStatus(201)
            ->assertJsonPath('created_by', $user->id)
            ->assertJsonPath('creator.id', $user->id);
    }

    public function test_danh_sach_tra_ve_kem_options(): void
    {
        $user = $this->user();
        $this->actingAs($user)->postJson('/api/car-rentals', $this->payload());

        $this->actingAs($user)
            ->getJson('/api/car-rentals')
            ->assertStatus(200)
            ->assertJsonCount(1)
            ->assertJsonPath('0.options.1.total_cost', 1380000);
    }

    public function test_xem_chi_tiet(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload())
            ->json('id');

        $this->actingAs($user)
            ->getJson("/api/car-rentals/{$id}")
            ->assertStatus(200)
            ->assertJsonPath('name', 'Chuyến Đà Lạt')
            ->assertJsonCount(2, 'options');
    }

    public function test_cap_nhat_thay_the_toan_bo_options(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload())
            ->json('id');

        $payload = $this->payload(['distance_km' => 400, 'name' => 'Chuyến Vũng Tàu']);
        $payload['options'][] = [
            'name' => 'Xe xăng nhà B',
            'sort_order' => 2,
            'rental_per_day' => 450000,
            'fuel_type' => 'petrol',
            'consumption_per_100' => 7,
            'fuel_unit_price' => 30000,
            'extra_fixed_cost' => 0,
            'km_limit_per_day' => null,
            'over_km_fee' => 0,
        ];

        $this->actingAs($user)
            ->putJson("/api/car-rentals/{$id}", $payload)
            ->assertStatus(200)
            ->assertJsonPath('name', 'Chuyến Vũng Tàu')
            ->assertJsonPath('break_even_km', null)
            ->assertJsonCount(3, 'options');

        $this->assertSame(3, CarRentalOption::count(), 'options cũ phải bị xóa, không cộng dồn');
    }

    public function test_xoa(): void
    {
        $user = $this->user();
        $id = $this->actingAs($user)
            ->postJson('/api/car-rentals', $this->payload())
            ->json('id');

        $this->actingAs($user)
            ->deleteJson("/api/car-rentals/{$id}")
            ->assertStatus(200);

        $this->assertSame(0, CarRentalComparison::count());
        $this->assertSame(0, CarRentalOption::count());
    }

    public function test_it_hon_2_phuong_an_bi_422(): void
    {
        $payload = $this->payload();
        $payload['options'] = array_slice($payload['options'], 0, 1);

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('options');
    }

    public function test_fuel_type_khong_hop_le_bi_422(): void
    {
        $payload = $this->payload();
        $payload['options'][0]['fuel_type'] = 'diesel';

        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $payload)
            ->assertStatus(422)
            ->assertJsonValidationErrors('options.0.fuel_type');
    }

    public function test_so_ngay_nho_hon_1_bi_422(): void
    {
        $this->actingAs($this->user())
            ->postJson('/api/car-rentals', $this->payload(['days' => 0]))
            ->assertStatus(422)
            ->assertJsonValidationErrors('days');
    }
}
```

- [ ] **Step 2: Chạy test để chắc chắn nó fail**

Run: `cd BACKEND && php artisan test --filter=CarRentalControllerTest`
Expected: FAIL — 404 vì route chưa tồn tại

- [ ] **Step 3: Viết FormRequests, Controller và routes**

`BACKEND/app/Http/Requests/StoreCarRentalComparisonRequest.php`:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCarRentalComparisonRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'nullable|string|max:255',
            'date' => 'nullable|date',
            'days' => 'required|integer|min:1',
            'distance_km' => 'required|integer|min:0',
            'people_count' => 'nullable|integer|min:0',
            'note' => 'nullable|string',
            'options' => 'required|array|min:2',
            'options.*.name' => 'required|string|max:255',
            'options.*.sort_order' => 'nullable|integer|min:0',
            'options.*.rental_per_day' => 'required|integer|min:0',
            'options.*.fuel_type' => 'required|in:petrol,electric,none',
            'options.*.consumption_per_100' => 'nullable|numeric|min:0',
            'options.*.fuel_unit_price' => 'nullable|integer|min:0',
            'options.*.extra_fixed_cost' => 'nullable|integer|min:0',
            'options.*.km_limit_per_day' => 'nullable|integer|min:1',
            'options.*.over_km_fee' => 'nullable|integer|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'options.min' => 'Cần ít nhất 2 phương án để so sánh.',
            'options.*.fuel_type.in' => 'Loại nhiên liệu phải là xăng, điện hoặc không tốn.',
            'days.min' => 'Số ngày thuê phải từ 1 trở lên.',
        ];
    }
}
```

`BACKEND/app/Http/Requests/UpdateCarRentalComparisonRequest.php` — nội dung giống hệt, chỉ khác tên class:

```php
<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateCarRentalComparisonRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name' => 'nullable|string|max:255',
            'date' => 'nullable|date',
            'days' => 'required|integer|min:1',
            'distance_km' => 'required|integer|min:0',
            'people_count' => 'nullable|integer|min:0',
            'note' => 'nullable|string',
            'options' => 'required|array|min:2',
            'options.*.name' => 'required|string|max:255',
            'options.*.sort_order' => 'nullable|integer|min:0',
            'options.*.rental_per_day' => 'required|integer|min:0',
            'options.*.fuel_type' => 'required|in:petrol,electric,none',
            'options.*.consumption_per_100' => 'nullable|numeric|min:0',
            'options.*.fuel_unit_price' => 'nullable|integer|min:0',
            'options.*.extra_fixed_cost' => 'nullable|integer|min:0',
            'options.*.km_limit_per_day' => 'nullable|integer|min:1',
            'options.*.over_km_fee' => 'nullable|integer|min:0',
        ];
    }

    public function messages(): array
    {
        return [
            'options.min' => 'Cần ít nhất 2 phương án để so sánh.',
            'options.*.fuel_type.in' => 'Loại nhiên liệu phải là xăng, điện hoặc không tốn.',
            'days.min' => 'Số ngày thuê phải từ 1 trở lên.',
        ];
    }
}
```

`BACKEND/app/Http/Controllers/Api/CarRentalController.php`:

```php
<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreCarRentalComparisonRequest;
use App\Http\Requests\UpdateCarRentalComparisonRequest;
use App\Models\CarRentalComparison;
use App\Services\CarRentalCalculator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CarRentalController extends Controller
{
    public function __construct(private CarRentalCalculator $calculator)
    {
    }

    public function index(): JsonResponse
    {
        $comparisons = CarRentalComparison::with(['creator', 'options'])
            ->orderBy('date', 'desc')
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json($comparisons);
    }

    public function show(string $id): JsonResponse
    {
        $comparison = CarRentalComparison::with(['creator', 'options'])->findOrFail($id);

        return response()->json($comparison);
    }

    public function store(StoreCarRentalComparisonRequest $request): JsonResponse
    {
        $comparison = DB::transaction(
            fn () => $this->persist(new CarRentalComparison(), $request)
        );

        return response()->json($comparison->load(['creator', 'options']), 201);
    }

    public function update(UpdateCarRentalComparisonRequest $request, string $id): JsonResponse
    {
        $comparison = CarRentalComparison::findOrFail($id);

        $comparison = DB::transaction(
            fn () => $this->persist($comparison, $request)
        );

        return response()->json($comparison->load(['creator', 'options']));
    }

    public function destroy(string $id): JsonResponse
    {
        CarRentalComparison::findOrFail($id)->delete();

        return response()->json(['message' => 'Đã xóa so sánh thuê xe.']);
    }

    /**
     * Tính lại từ input rồi ghi đè toàn bộ options.
     *
     * Cố ý KHÔNG đọc bất kỳ trường kết quả nào client gửi lên: chỉ input được
     * dùng, mọi con số lưu xuống đều do CarRentalCalculator tính.
     */
    private function persist(CarRentalComparison $comparison, Request $request): CarRentalComparison
    {
        $days = (int) $request->input('days');
        $distanceKm = (int) $request->input('distance_km');
        $peopleCount = (int) ($request->input('people_count') ?? 0);

        $result = $this->calculator->calculate([
            'days' => $days,
            'distance_km' => $distanceKm,
            'people_count' => $peopleCount,
            'options' => $request->input('options', []),
        ]);

        $comparison->fill([
            'name' => $request->input('name') ?: null,
            'date' => $request->input('date') ?: null,
            'days' => $days,
            'distance_km' => $distanceKm,
            'people_count' => $peopleCount,
            'note' => $request->input('note') ?: null,
            'break_even_km' => $result['break_even_km'],
            'saving_amount' => $result['saving_amount'],
        ]);

        if (! $comparison->exists) {
            $comparison->created_by = $request->user()?->id;
        }

        $comparison->save();
        $comparison->options()->delete();

        foreach ($result['options'] as $option) {
            $comparison->options()->create($option);
        }

        return $comparison;
    }
}
```

Sửa `BACKEND/routes/api.php`. Thêm vào khối `use` ở đầu file, giữ đúng thứ tự alphabet (ngay sau `BracketController`):

```php
use App\Http\Controllers\Api\CarRentalController;
```

Rồi thêm route bên trong nhóm `Route::middleware('auth')->group(...)`, ngay sau dòng `Route::apiResource('party-bills', ...)`:

```php
    // Car Rentals (So sánh chi phí thuê xe)
    Route::apiResource('car-rentals', CarRentalController::class)
        ->only(['index', 'store', 'show', 'update', 'destroy']);
```

- [ ] **Step 4: Chạy test để chắc chắn nó pass**

Run: `cd BACKEND && php artisan test --filter=CarRental`
Expected: PASS, tổng 26 tests (13 unit + 2 model + 11 controller)

- [ ] **Step 5: Commit**

```bash
git add BACKEND/app/Http/Requests/StoreCarRentalComparisonRequest.php \
        BACKEND/app/Http/Requests/UpdateCarRentalComparisonRequest.php \
        BACKEND/app/Http/Controllers/Api/CarRentalController.php \
        BACKEND/routes/api.php \
        BACKEND/tests/Feature/CarRentalControllerTest.php
git commit -m "feat(car-rental): API CRUD so sánh thuê xe, backend tự tính không tin client"
```

---

### Task 4: Quyền `car_rentals`

**Files:**
- Modify: `BACKEND/database/seeders/RolePermissionSeeder.php`

**Interfaces:**
- Consumes: không có
- Produces: 4 bản ghi permission `car_rentals.view`, `car_rentals.create`, `car_rentals.update`, `car_rentals.delete`, gán cho role `admin`. Frontend (Task 6-8) đọc các tên này qua `hasPermission()`.

- [ ] **Step 1: Thêm permission vào mảng `$permissions`**

Trong `BACKEND/database/seeders/RolePermissionSeeder.php`, thêm khối sau vào cuối mảng `$permissions` (ngay sau nhóm `tournament_brackets`):

```php
            // Car Rentals (So sánh chi phí thuê xe)
            ['name' => 'car_rentals.view', 'display_name' => 'Xem so sánh thuê xe', 'group' => 'car_rentals'],
            ['name' => 'car_rentals.create', 'display_name' => 'Tạo so sánh thuê xe', 'group' => 'car_rentals'],
            ['name' => 'car_rentals.update', 'display_name' => 'Sửa so sánh thuê xe', 'group' => 'car_rentals'],
            ['name' => 'car_rentals.delete', 'display_name' => 'Xóa so sánh thuê xe', 'group' => 'car_rentals'],
```

- [ ] **Step 2: Gán 4 quyền cho role admin**

Đọc phần gán quyền cho role `admin` trong cùng file. Nếu admin được gán **toàn bộ** permission (ví dụ `$adminRole->permissions()->sync(Permission::pluck('id'))`) thì **không cần sửa gì thêm** — bỏ qua step này.

Nếu admin dùng một mảng tên quyền liệt kê tay, thêm 4 dòng vào mảng đó:

```php
            'car_rentals.view',
            'car_rentals.create',
            'car_rentals.update',
            'car_rentals.delete',
```

- [ ] **Step 3: Chạy seeder và kiểm chứng**

Run:
```bash
cd BACKEND && php artisan db:seed --class=RolePermissionSeeder
php artisan tinker --execute="echo App\Models\Permission::where('group','car_rentals')->count();"
```
Expected: in ra `4`

Kiểm chứng admin có quyền:
```bash
php artisan tinker --execute="echo App\Models\Role::where('name','admin')->first()->hasPermission('car_rentals.view') ? 'OK' : 'THIEU';"
```
Expected: in ra `OK`. Nếu ra `THIEU`, quay lại Step 2 và gán tay.

- [ ] **Step 4: Chạy lại toàn bộ test backend để chắc chắn không vỡ gì**

Run: `cd BACKEND && php artisan test`
Expected: PASS toàn bộ

- [ ] **Step 5: Commit**

```bash
git add BACKEND/database/seeders/RolePermissionSeeder.php
git commit -m "feat(car-rental): thêm nhóm quyền car_rentals và gán cho admin"
```

---

### Task 5: Công thức phía frontend + Vitest

**Files:**
- Create: `FRONTEND/src/utils/carRentalCost.js`
- Create: `FRONTEND/src/utils/carRentalCost.test.js`
- Create: `FRONTEND/vitest.config.js`
- Modify: `FRONTEND/package.json` (thêm devDependency `vitest` và script `test`)
- **KHÔNG ĐỘNG VÀO** `FRONTEND/vite.config.js`

**Interfaces:**
- Consumes: không có
- Produces: `calculateCarRental(input)` export từ `src/utils/carRentalCost.js`. Nhận và trả về **đúng hình dạng dữ liệu snake_case giống `CarRentalCalculator::calculate()`** ở Task 1.

- [ ] **Step 1: Cài Vitest và tạo config riêng**

Run: `cd FRONTEND && npm install --save-dev vitest`

Thêm vào `"scripts"` trong `FRONTEND/package.json`, ngay sau dòng `"lint"`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

Tạo `FRONTEND/vitest.config.js`. File riêng này khiến Vitest **bỏ qua `vite.config.js`** — đúng ý đồ, vì `vite.config.js` là cấu hình proxy dev cục bộ không được commit:

```js
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.js"],
  },
});
```

- [ ] **Step 2: Viết test thất bại**

Tạo `FRONTEND/src/utils/carRentalCost.test.js`. Bộ số kỳ vọng **phải khớp từng đồng** với `CarRentalCalculatorTest.php` ở Task 1:

```js
import { describe, expect, it } from "vitest";
import { calculateCarRental } from "./carRentalCost";

const petrol = (overrides = {}) => ({
  name: "Xe xăng",
  sort_order: 0,
  rental_per_day: 500000,
  fuel_type: "petrol",
  consumption_per_100: 7,
  fuel_unit_price: 30000,
  extra_fixed_cost: 0,
  km_limit_per_day: null,
  over_km_fee: 0,
  ...overrides,
});

const electric = (overrides = {}) => ({
  name: "Xe điện",
  sort_order: 1,
  rental_per_day: 690000,
  fuel_type: "electric",
  consumption_per_100: 0,
  fuel_unit_price: 0,
  extra_fixed_cost: 0,
  km_limit_per_day: null,
  over_km_fee: 0,
  ...overrides,
});

const trip = (options, overrides = {}) => ({
  days: 2,
  distance_km: 800,
  people_count: 0,
  options,
  ...overrides,
});

describe("calculateCarRental", () => {
  it("khớp bài toán mẫu 800km 2 ngày", () => {
    const result = calculateCarRental(trip([petrol(), electric()]));
    const [xang, dien] = result.options;

    expect(xang.rental_cost).toBe(1000000);
    expect(xang.fuel_cost).toBe(1680000);
    expect(xang.over_km_cost).toBe(0);
    expect(xang.total_cost).toBe(2680000);
    expect(xang.cost_per_km).toBe(3350);
    expect(xang.is_cheapest).toBe(false);

    expect(dien.total_cost).toBe(1380000);
    expect(dien.cost_per_km).toBe(1725);
    expect(dien.is_cheapest).toBe(true);

    expect(result.saving_amount).toBe(1300000);
    expect(result.break_even_km).toBe(181);
  });

  it("tính đúng khi xe điện sạc trả phí", () => {
    const result = calculateCarRental(
      trip([petrol(), electric({ consumption_per_100: 18, fuel_unit_price: 3858 })])
    );

    expect(result.options[1].fuel_cost).toBe(555552);
    expect(result.options[1].total_cost).toBe(1935552);
    expect(result.saving_amount).toBe(744448);
  });

  it("cộng phí vượt giới hạn km cho cả hai phương án", () => {
    const result = calculateCarRental(
      trip([
        petrol({ km_limit_per_day: 300, over_km_fee: 4000 }),
        electric({ km_limit_per_day: 300, over_km_fee: 4000 }),
      ])
    );

    expect(result.options[0].over_km_cost).toBe(800000);
    expect(result.options[1].over_km_cost).toBe(800000);
    expect(result.options[0].total_cost).toBe(3480000);
    expect(result.options[1].total_cost).toBe(2180000);
  });

  it("không tính vượt khi giới hạn đủ lớn", () => {
    const result = calculateCarRental(
      trip([petrol({ km_limit_per_day: 500, over_km_fee: 4000 }), electric()])
    );

    expect(result.options[0].over_km_cost).toBe(0);
  });

  it("cộng chi phí cố định khác vào tổng", () => {
    const result = calculateCarRental(
      trip([petrol({ extra_fixed_cost: 200000 }), electric()])
    );

    expect(result.options[0].total_cost).toBe(2880000);
  });

  it("bỏ qua tiêu hao khi fuel_type là none", () => {
    const result = calculateCarRental(trip([petrol({ fuel_type: "none" }), electric()]));

    expect(result.options[0].fuel_cost).toBe(0);
    expect(result.options[0].total_cost).toBe(1000000);
  });

  it("không chia cho 0 khi quãng đường bằng 0", () => {
    const result = calculateCarRental(trip([petrol(), electric()], { distance_km: 0 }));

    expect(result.options[0].cost_per_km).toBe(0);
    expect(result.options[0].fuel_cost).toBe(0);
  });

  it("chia đầu người", () => {
    const result = calculateCarRental(trip([petrol(), electric()], { people_count: 8 }));

    expect(result.options[0].per_person_cost).toBe(335000);
    expect(result.options[1].per_person_cost).toBe(172500);
  });

  it("không chia cho 0 khi số người bằng 0", () => {
    const result = calculateCarRental(trip([petrol(), electric()]));

    expect(result.options[0].per_person_cost).toBe(0);
  });

  it("không có điểm hòa vốn khi có 3 phương án", () => {
    const result = calculateCarRental(
      trip([
        petrol(),
        electric(),
        petrol({ name: "Xe xăng nhà B", sort_order: 2, rental_per_day: 450000 }),
      ])
    );

    expect(result.break_even_km).toBeNull();
    expect(result.options[1].is_cheapest).toBe(true);
  });

  it("không có nghiệm khi hai phương án cùng mức tiêu hao", () => {
    const result = calculateCarRental(
      trip([petrol(), petrol({ name: "Xe xăng nhà B", sort_order: 1, rental_per_day: 450000 })])
    );

    expect(result.break_even_km).toBeNull();
    expect(result.options[1].is_cheapest).toBe(true);
  });

  it("trả null khi điểm cắt âm", () => {
    const result = calculateCarRental(
      trip([petrol(), electric({ rental_per_day: 400000 })])
    );

    expect(result.break_even_km).toBeNull();
  });

  it("hòa tổng tiền thì sort_order nhỏ hơn thắng", () => {
    const result = calculateCarRental(
      trip([
        electric({ name: "Điện A", sort_order: 0 }),
        electric({ name: "Điện B", sort_order: 1 }),
      ])
    );

    expect(result.options[0].is_cheapest).toBe(true);
    expect(result.options[1].is_cheapest).toBe(false);
    expect(result.saving_amount).toBe(0);
  });
});
```

- [ ] **Step 3: Chạy test để chắc chắn nó fail**

Run: `cd FRONTEND && npm test`
Expected: FAIL — không resolve được `./carRentalCost`

- [ ] **Step 4: Viết implementation**

Tạo `FRONTEND/src/utils/carRentalCost.js`. Đây là bản sao 1-1 của `CarRentalCalculator.php`:

```js
/**
 * Công thức tính chi phí thuê xe cho một chuyến đi.
 *
 * QUAN TRỌNG: file này là bản sao 1-1 của BACKEND/app/Services/CarRentalCalculator.php.
 * Sửa một bên thì phải sửa bên kia, và hai bộ test (carRentalCost.test.js +
 * CarRentalCalculatorTest.php) dùng chung một bộ số kỳ vọng để ghim việc đó.
 *
 * Tên trường cố ý dùng snake_case để khớp định dạng đi trên dây của API.
 */

/** Sai số cho phép khi so sánh hai chi phí biến đổi (đ/km) dạng số thực. */
const EPSILON = 0.000001;

const toInt = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : 0;
};

const toFloat = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

function calculateOption(raw, index, days, distanceKm, peopleCount) {
  const fuelType = raw.fuel_type ?? "none";
  const rentalPerDay = toInt(raw.rental_per_day);
  const consumption = fuelType === "none" ? 0 : toFloat(raw.consumption_per_100);
  const fuelUnitPrice = toInt(raw.fuel_unit_price);
  const extraFixedCost = toInt(raw.extra_fixed_cost);
  const overKmFee = toInt(raw.over_km_fee);

  const kmLimitPerDay =
    raw.km_limit_per_day === null || raw.km_limit_per_day === undefined || raw.km_limit_per_day === ""
      ? null
      : toInt(raw.km_limit_per_day);

  const rentalCost = rentalPerDay * days;
  const fuelCost = Math.round((distanceKm * consumption) / 100 * fuelUnitPrice);

  const overKm =
    kmLimitPerDay === null ? 0 : Math.max(0, distanceKm - kmLimitPerDay * days);
  const overKmCost = overKm * overKmFee;

  const totalCost = rentalCost + fuelCost + overKmCost + extraFixedCost;

  return {
    name: raw.name ?? "",
    sort_order: raw.sort_order === undefined || raw.sort_order === null ? index : toInt(raw.sort_order),
    rental_per_day: rentalPerDay,
    fuel_type: fuelType,
    consumption_per_100: consumption,
    fuel_unit_price: fuelUnitPrice,
    extra_fixed_cost: extraFixedCost,
    km_limit_per_day: kmLimitPerDay,
    over_km_fee: overKmFee,
    rental_cost: rentalCost,
    fuel_cost: fuelCost,
    over_km_cost: overKmCost,
    total_cost: totalCost,
    cost_per_km: distanceKm > 0 ? Math.round(totalCost / distanceKm) : 0,
    per_person_cost: peopleCount > 0 ? Math.round(totalCost / peopleCount) : 0,
    is_cheapest: false,
  };
}

/** Đánh dấu phương án tổng tiền nhỏ nhất. Hòa thì sort_order nhỏ hơn thắng. */
function markCheapest(options) {
  if (options.length === 0) return options;

  let winner = 0;
  options.forEach((option, i) => {
    const best = options[winner];
    const cheaper = option.total_cost < best.total_cost;
    const tieButEarlier =
      option.total_cost === best.total_cost && option.sort_order < best.sort_order;

    if (cheaper || tieButEarlier) winner = i;
  });

  options[winner].is_cheapest = true;

  return options;
}

function savingAmount(options) {
  if (options.length < 2) return 0;

  const totals = options.map((o) => o.total_cost).sort((a, b) => a - b);

  return totals[1] - totals[0];
}

/**
 * Quãng đường mà hai phương án hòa chi phí.
 *
 * Chỉ tính khi có đúng 2 phương án và CỐ Ý bỏ qua phí vượt km, vì phí vượt là
 * hàm bậc thang làm bài toán mất tính tuyến tính. Màn hình phải ghi rõ
 * "(chưa tính phí vượt km)" khi người dùng có bật giới hạn km.
 */
function breakEvenKm(options, days) {
  if (options.length !== 2) return null;

  const [a, b] = options;

  const fixedA = a.rental_per_day * days + a.extra_fixed_cost;
  const fixedB = b.rental_per_day * days + b.extra_fixed_cost;
  const varA = (a.consumption_per_100 / 100) * a.fuel_unit_price;
  const varB = (b.consumption_per_100 / 100) * b.fuel_unit_price;

  if (Math.abs(varA - varB) < EPSILON) return null;

  const distance = (fixedB - fixedA) / (varA - varB);

  return distance > 0 ? Math.round(distance) : null;
}

export function calculateCarRental(input) {
  const days = toInt(input.days);
  const distanceKm = toInt(input.distance_km);
  const peopleCount = toInt(input.people_count);

  const options = markCheapest(
    (input.options ?? []).map((raw, index) =>
      calculateOption(raw, index, days, distanceKm, peopleCount)
    )
  );

  return {
    break_even_km: breakEvenKm(options, days),
    saving_amount: savingAmount(options),
    options,
  };
}
```

- [ ] **Step 5: Chạy test để chắc chắn nó pass**

Run: `cd FRONTEND && npm test`
Expected: PASS, 13 tests

- [ ] **Step 6: Kiểm tra `vite.config.js` chưa bị đụng vào**

Run: `git status --short FRONTEND/vite.config.js`
Expected: KHÔNG có dòng nào mới xuất hiện so với trước task này. File này không được nằm trong `git add` ở bước sau.

- [ ] **Step 7: Commit**

```bash
git add FRONTEND/src/utils/carRentalCost.js \
        FRONTEND/src/utils/carRentalCost.test.js \
        FRONTEND/vitest.config.js \
        FRONTEND/package.json \
        FRONTEND/package-lock.json
git commit -m "feat(car-rental): công thức tính phía frontend + Vitest ghim khớp với PHP"
```

---

### Task 6: Nối dây frontend — API client, route, menu, khung 2 tab

Sau task này mở `/car-rental` phải ra một trang có 2 tab chuyển qua lại được, dù nội dung 2 tab còn rỗng.

**Files:**
- Modify: `FRONTEND/src/services/api.js` (thêm khối `carRentalsApi` ngay trước dòng cuối `export default api;`)
- Create: `FRONTEND/src/screens/car-rental/CarRentalComparison.jsx`
- Create: `FRONTEND/src/screens/car-rental/CarRentalCalculator.jsx` (bản rỗng, Task 7 điền)
- Create: `FRONTEND/src/screens/car-rental/CarRentalHistory.jsx` (bản rỗng, Task 8 điền)
- Modify: `FRONTEND/src/App.jsx`
- Modify: `FRONTEND/src/components/Layout.jsx`

**Interfaces:**
- Consumes: quyền `car_rentals.view` (Task 4); endpoint `/api/car-rentals` (Task 3)
- Produces:
  - `carRentalsApi` với `getAll()`, `getById(id)`, `create(data)`, `update(id, data)`, `delete(id)`
  - `CarRentalCalculator` nhận props `{ editing, onSaved, onCancelEdit }` — `editing` là object comparison hoặc `null`
  - `CarRentalHistory` nhận props `{ reloadKey, onEdit }` — `onEdit(comparison)` chuyển sang tab tính toán

- [ ] **Step 1: Thêm API client**

Trong `FRONTEND/src/services/api.js`, chèn ngay **trước** dòng `export default api;`:

```js
// Car Rentals (So sánh chi phí thuê xe)
export const carRentalsApi = {
  getAll: () => api.get("/car-rentals"),
  getById: (id) => api.get(`/car-rentals/${id}`),
  create: (data) => api.post("/car-rentals", data),
  update: (id, data) => api.put(`/car-rentals/${id}`, data),
  delete: (id) => api.delete(`/car-rentals/${id}`),
};
```

- [ ] **Step 2: Tạo 2 component rỗng để Task 7-8 điền vào**

`FRONTEND/src/screens/car-rental/CarRentalCalculator.jsx`:

```jsx
export default function CarRentalCalculator() {
  return <div className="text-gray-600">Máy tính chi phí (Task 7).</div>;
}
```

`FRONTEND/src/screens/car-rental/CarRentalHistory.jsx`:

```jsx
export default function CarRentalHistory() {
  return <div className="text-gray-600">Lịch sử so sánh (Task 8).</div>;
}
```

- [ ] **Step 3: Tạo khung 2 tab**

`FRONTEND/src/screens/car-rental/CarRentalComparison.jsx`:

```jsx
import { useState } from "react";
import CarRentalCalculator from "./CarRentalCalculator";
import CarRentalHistory from "./CarRentalHistory";

const TABS = [
  { key: "calculator", label: "Tính toán" },
  { key: "history", label: "Lịch sử" },
];

export default function CarRentalComparison() {
  const [tab, setTab] = useState("calculator");
  const [editing, setEditing] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const handleEdit = (comparison) => {
    setEditing(comparison);
    setTab("calculator");
  };

  const handleSaved = () => {
    setEditing(null);
    setReloadKey((key) => key + 1);
    setTab("history");
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          🚗 So sánh chi phí thuê xe
        </h1>
        <p className="text-gray-600 mt-1">
          Nhập chuyến đi và các phương án thuê để xem phương án nào rẻ hơn.
        </p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 mb-4">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`px-4 py-2 -mb-px border-b-2 font-medium transition-colors ${
              tab === item.key
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "calculator" ? (
        <CarRentalCalculator
          editing={editing}
          onSaved={handleSaved}
          onCancelEdit={() => setEditing(null)}
        />
      ) : (
        <CarRentalHistory reloadKey={reloadKey} onEdit={handleEdit} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Thêm route**

Trong `FRONTEND/src/App.jsx`, thêm import cùng nhóm với các import screen khác (sau dòng `import TournamentBrackets ...`):

```jsx
import CarRentalComparison from "./screens/car-rental/CarRentalComparison";
```

Thêm route vào trong `<Routes>`, ngay sau block route `/tournament-brackets`:

```jsx
      <Route
        path="/car-rental"
        element={
          <ProtectedRoute requiredPermission="car_rentals.view">
            <Layout>
              <CarRentalComparison />
            </Layout>
          </ProtectedRoute>
        }
      />
```

- [ ] **Step 5: Thêm item sidebar**

Trong `FRONTEND/src/components/Layout.jsx`, thêm vào mảng `allNavItems`, ngay **trước** item `/master`:

```jsx
    {
      path: "/car-rental",
      label: "Thuê xe",
      icon: "🚗",
      permission: "car_rentals.view",
    },
```

- [ ] **Step 6: Kiểm chứng bằng mắt**

Run: `cd FRONTEND && npm run dev` (backend chạy song song: `cd BACKEND && php artisan serve`)

Đăng nhập bằng tài khoản admin rồi kiểm:
1. Sidebar có mục 🚗 "Thuê xe".
2. Bấm vào ra trang có tiêu đề "So sánh chi phí thuê xe" và 2 tab.
3. Bấm qua lại 2 tab thấy nội dung đổi.
4. Console trình duyệt không có lỗi đỏ.

Run: `cd FRONTEND && npm run lint`
Expected: không có lỗi mới

- [ ] **Step 7: Commit**

```bash
git add FRONTEND/src/services/api.js \
        FRONTEND/src/screens/car-rental/ \
        FRONTEND/src/App.jsx \
        FRONTEND/src/components/Layout.jsx
git commit -m "feat(car-rental): route /car-rental, menu sidebar và khung 2 tab"
```

---

### Task 7: Tab Tính toán

**Files:**
- Modify: `FRONTEND/src/screens/car-rental/CarRentalCalculator.jsx` (thay toàn bộ nội dung rỗng từ Task 6)

**Interfaces:**
- Consumes: `calculateCarRental` từ `../../utils/carRentalCost` (Task 5); `carRentalsApi` từ `../../services/api` (Task 6); `formatCurrency`, `formatNumber` từ `../../utils/formatters`; `useAuth` từ `../../contexts/AuthContext`
- Produces: component nhận `{ editing, onSaved, onCancelEdit }`, gọi `onSaved()` sau khi lưu thành công

- [ ] **Step 1: Viết toàn bộ component**

Thay toàn bộ `FRONTEND/src/screens/car-rental/CarRentalCalculator.jsx` bằng:

```jsx
import { useEffect, useMemo, useState } from "react";
import { calculateCarRental } from "../../utils/carRentalCost";
import { carRentalsApi } from "../../services/api";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import { useAuth } from "../../contexts/AuthContext";

const FUEL_TYPES = [
  { value: "petrol", label: "Xăng", unit: "L/100km", priceUnit: "đ/lít" },
  { value: "electric", label: "Điện", unit: "kWh/100km", priceUnit: "đ/kWh" },
  { value: "none", label: "Không tốn nhiên liệu", unit: "", priceUnit: "" },
];

const fuelMeta = (fuelType) =>
  FUEL_TYPES.find((item) => item.value === fuelType) ?? FUEL_TYPES[2];

const makeOption = (overrides = {}) => ({
  name: "",
  rental_per_day: 0,
  fuel_type: "petrol",
  consumption_per_100: 0,
  fuel_unit_price: 0,
  extra_fixed_cost: 0,
  km_limit_per_day: null,
  over_km_fee: 0,
  ...overrides,
});

const DEFAULT_TRIP = {
  name: "",
  date: "",
  days: 2,
  distance_km: 0,
  people_count: 0,
  note: "",
};

const DEFAULT_OPTIONS = [
  makeOption({
    name: "Xe xăng",
    rental_per_day: 500000,
    fuel_type: "petrol",
    consumption_per_100: 7,
    fuel_unit_price: 30000,
  }),
  makeOption({
    name: "Xe điện",
    rental_per_day: 690000,
    fuel_type: "electric",
    consumption_per_100: 0,
    fuel_unit_price: 0,
  }),
];

/** Câu mô tả điểm hòa vốn, kèm cảnh báo khi có bật giới hạn km. */
function breakEvenText(result, distanceKm, hasKmLimit) {
  if (result.options.length !== 2) {
    return "Điểm hòa vốn chỉ tính được khi so đúng 2 phương án.";
  }

  const cheapest = result.options.find((option) => option.is_cheapest);
  const cheapestName = cheapest?.name || "Phương án rẻ nhất";
  const note = hasKmLimit ? " (chưa tính phí vượt km)" : "";

  if (result.break_even_km === null) {
    return `${cheapestName} rẻ hơn ở mọi quãng đường${note}.`;
  }

  const side = distanceKm >= result.break_even_km ? "trên" : "dưới";

  return `Đi ${side} ${formatNumber(result.break_even_km)} km thì ${cheapestName} rẻ hơn${note}.`;
}

function buildCopyText(trip, result, hasKmLimit) {
  const lines = [];

  lines.push(`🚗 ${trip.name || "So sánh chi phí thuê xe"}`);
  lines.push(
    `Chuyến ${trip.days} ngày · ${formatNumber(trip.distance_km)} km (cả đi lẫn về)`
  );
  lines.push("");

  result.options.forEach((option) => {
    lines.push(
      `${option.is_cheapest ? "✅" : "▫️"} ${option.name || "(chưa đặt tên)"}: ${formatCurrency(option.total_cost)}`
    );

    const parts = [
      `Thuê ${formatCurrency(option.rental_cost)}`,
      `Nhiên liệu ${formatCurrency(option.fuel_cost)}`,
    ];
    if (option.over_km_cost > 0) parts.push(`Vượt km ${formatCurrency(option.over_km_cost)}`);
    if (option.extra_fixed_cost > 0) parts.push(`Khác ${formatCurrency(option.extra_fixed_cost)}`);
    lines.push(`   ${parts.join(" · ")}`);

    const perKm = `${formatCurrency(option.cost_per_km)}/km`;
    lines.push(
      trip.people_count > 0
        ? `   ${perKm} · ${formatCurrency(option.per_person_cost)}/người`
        : `   ${perKm}`
    );
  });

  lines.push("");
  if (result.saving_amount > 0) {
    lines.push(`👉 Tiết kiệm ${formatCurrency(result.saving_amount)}`);
  }
  lines.push(breakEvenText(result, trip.distance_km, hasKmLimit));

  return lines.join("\n");
}

export default function CarRentalCalculator({ editing, onSaved, onCancelEdit }) {
  const { hasPermission } = useAuth();
  const [trip, setTrip] = useState(DEFAULT_TRIP);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  // Nạp lại một bản ghi cũ từ tab Lịch sử vào form.
  useEffect(() => {
    if (!editing) return;

    setTrip({
      name: editing.name ?? "",
      date: editing.date ? String(editing.date).slice(0, 10) : "",
      days: editing.days ?? 1,
      distance_km: editing.distance_km ?? 0,
      people_count: editing.people_count ?? 0,
      note: editing.note ?? "",
    });

    setOptions(
      (editing.options ?? []).map((option) =>
        makeOption({
          name: option.name,
          rental_per_day: option.rental_per_day,
          fuel_type: option.fuel_type,
          consumption_per_100: Number(option.consumption_per_100),
          fuel_unit_price: option.fuel_unit_price,
          extra_fixed_cost: option.extra_fixed_cost,
          km_limit_per_day: option.km_limit_per_day,
          over_km_fee: option.over_km_fee,
        })
      )
    );

    setShowAdvanced(
      (editing.options ?? []).some(
        (option) => option.km_limit_per_day !== null || option.extra_fixed_cost > 0
      )
    );
  }, [editing]);

  const result = useMemo(
    () =>
      calculateCarRental({
        days: trip.days,
        distance_km: trip.distance_km,
        people_count: trip.people_count,
        options: options.map((option, index) => ({ ...option, sort_order: index })),
      }),
    [trip, options]
  );

  const hasKmLimit = options.some((option) => option.km_limit_per_day !== null);

  const setTripField = (field) => (event) => {
    const raw = event.target.value;
    const numeric = ["days", "distance_km", "people_count"].includes(field);
    setTrip((prev) => ({ ...prev, [field]: numeric ? Number(raw) || 0 : raw }));
  };

  const setOptionField = (index, field, value) => {
    setOptions((prev) =>
      prev.map((option, i) => (i === index ? { ...option, [field]: value } : option))
    );
  };

  const addOption = () =>
    setOptions((prev) => [...prev, makeOption({ name: `Phương án ${prev.length + 1}` })]);

  const removeOption = (index) =>
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== index)));

  const resetForm = () => {
    setTrip(DEFAULT_TRIP);
    setOptions(DEFAULT_OPTIONS);
    setShowAdvanced(false);
    onCancelEdit?.();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildCopyText(trip, result, hasKmLimit));
      setMessage({ type: "success", text: "Đã copy kết quả." });
    } catch {
      setMessage({ type: "error", text: "Trình duyệt không cho copy. Hãy bôi đen và copy tay." });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const payload = {
      name: trip.name || null,
      date: trip.date || null,
      days: trip.days,
      distance_km: trip.distance_km,
      people_count: trip.people_count,
      note: trip.note || null,
      options: options.map((option, index) => ({
        name: option.name || `Phương án ${index + 1}`,
        sort_order: index,
        rental_per_day: option.rental_per_day,
        fuel_type: option.fuel_type,
        consumption_per_100: option.consumption_per_100,
        fuel_unit_price: option.fuel_unit_price,
        extra_fixed_cost: option.extra_fixed_cost,
        km_limit_per_day: option.km_limit_per_day,
        over_km_fee: option.over_km_fee,
      })),
    };

    try {
      if (editing) {
        await carRentalsApi.update(editing.id, payload);
      } else {
        await carRentalsApi.create(payload);
      }
      resetForm();
      onSaved?.();
    } catch (error) {
      const detail = error?.response?.data?.message || "Không lưu được. Thử lại giúp mình.";
      setMessage({ type: "error", text: detail });
    } finally {
      setSaving(false);
    }
  };

  const canSave = editing
    ? hasPermission("car_rentals.update")
    : hasPermission("car_rentals.create");

  const inputClass =
    "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg ${
            message.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {editing && (
        <div className="px-4 py-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-between gap-3">
          <span>Đang sửa bản ghi đã lưu trước đó.</span>
          <button type="button" onClick={resetForm} className="underline font-medium">
            Hủy sửa
          </button>
        </div>
      )}

      {/* Thông tin chuyến đi */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Chuyến đi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Tên chuyến</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Chuyến Đà Lạt"
              value={trip.name}
              onChange={setTripField("name")}
            />
          </div>
          <div>
            <label className={labelClass}>Ngày đi</label>
            <input type="date" className={inputClass} value={trip.date} onChange={setTripField("date")} />
          </div>
          <div>
            <label className={labelClass}>Số ngày thuê</label>
            <input type="number" min="1" className={inputClass} value={trip.days} onChange={setTripField("days")} />
          </div>
          <div>
            <label className={labelClass}>Tổng km (cả đi lẫn về)</label>
            <input
              type="number"
              min="0"
              className={inputClass}
              value={trip.distance_km}
              onChange={setTripField("distance_km")}
            />
          </div>
          <div>
            <label className={labelClass}>Số người đi (0 = không chia)</label>
            <input
              type="number"
              min="0"
              className={inputClass}
              value={trip.people_count}
              onChange={setTripField("people_count")}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={labelClass}>Ghi chú</label>
            <input type="text" className={inputClass} value={trip.note} onChange={setTripField("note")} />
          </div>
        </div>
      </section>

      {/* Các phương án */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Phương án thuê xe</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(event) => setShowAdvanced(event.target.checked)}
            />
            Nâng cao
          </label>
        </div>

        <div className="space-y-4">
          {options.map((option, index) => {
            const meta = fuelMeta(option.fuel_type);

            return (
              <div key={index} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <input
                    type="text"
                    className="font-medium text-gray-900 border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500 bg-transparent"
                    placeholder={`Phương án ${index + 1}`}
                    value={option.name}
                    onChange={(event) => setOptionField(index, "name", event.target.value)}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Xóa
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Giá thuê / ngày (đ)</label>
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={option.rental_per_day}
                      onChange={(event) =>
                        setOptionField(index, "rental_per_day", Number(event.target.value) || 0)
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Nhiên liệu</label>
                    <select
                      className={inputClass}
                      value={option.fuel_type}
                      onChange={(event) => setOptionField(index, "fuel_type", event.target.value)}
                    >
                      {FUEL_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {option.fuel_type !== "none" && (
                    <>
                      <div>
                        <label className={labelClass}>Tiêu hao ({meta.unit})</label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          className={inputClass}
                          value={option.consumption_per_100}
                          onChange={(event) =>
                            setOptionField(index, "consumption_per_100", Number(event.target.value) || 0)
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Đơn giá ({meta.priceUnit}) — 0 là miễn phí</label>
                        <input
                          type="number"
                          min="0"
                          className={inputClass}
                          value={option.fuel_unit_price}
                          onChange={(event) =>
                            setOptionField(index, "fuel_unit_price", Number(event.target.value) || 0)
                          }
                        />
                      </div>
                    </>
                  )}
                </div>

                {showAdvanced && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-dashed border-slate-200">
                    <div>
                      <label className={labelClass}>Chi phí cố định khác (đ)</label>
                      <input
                        type="number"
                        min="0"
                        className={inputClass}
                        value={option.extra_fixed_cost}
                        onChange={(event) =>
                          setOptionField(index, "extra_fixed_cost", Number(event.target.value) || 0)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Giới hạn km/ngày (trống = không giới hạn)</label>
                      <input
                        type="number"
                        min="1"
                        className={inputClass}
                        value={option.km_limit_per_day ?? ""}
                        onChange={(event) =>
                          setOptionField(
                            index,
                            "km_limit_per_day",
                            event.target.value === "" ? null : Number(event.target.value)
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Phí vượt (đ/km)</label>
                      <input
                        type="number"
                        min="0"
                        className={inputClass}
                        value={option.over_km_fee}
                        onChange={(event) =>
                          setOptionField(index, "over_km_fee", Number(event.target.value) || 0)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addOption}
          className="mt-4 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600"
        >
          + Thêm phương án
        </button>
      </section>

      {/* Kết quả */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Kết quả</h2>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-slate-200">
                <th className="py-2 pr-3">Phương án</th>
                <th className="py-2 px-3 text-right">Thuê</th>
                <th className="py-2 px-3 text-right">Nhiên liệu</th>
                <th className="py-2 px-3 text-right">Vượt km</th>
                <th className="py-2 px-3 text-right">Khác</th>
                <th className="py-2 px-3 text-right">Tổng</th>
                <th className="py-2 pl-3 text-right">đ/km</th>
              </tr>
            </thead>
            <tbody>
              {result.options.map((option, index) => (
                <tr
                  key={index}
                  className={`border-b border-slate-100 ${option.is_cheapest ? "bg-green-50" : ""}`}
                >
                  <td className="py-2 pr-3 font-medium text-gray-900">
                    {option.name || `Phương án ${index + 1}`}
                    {option.is_cheapest && (
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-600 text-white">
                        Rẻ nhất
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">{formatCurrency(option.rental_cost)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(option.fuel_cost)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(option.over_km_cost)}</td>
                  <td className="py-2 px-3 text-right">{formatCurrency(option.extra_fixed_cost)}</td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-900">
                    {formatCurrency(option.total_cost)}
                  </td>
                  <td className="py-2 pl-3 text-right">{formatCurrency(option.cost_per_km)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2">
          {result.saving_amount > 0 && (
            <div className="text-green-700 font-medium">
              Tiết kiệm {formatCurrency(result.saving_amount)}
              {result.options.length === 2 && (() => {
                const totals = result.options.map((option) => option.total_cost).sort((a, b) => b - a);
                return totals[0] > 0
                  ? ` (−${Math.round((result.saving_amount / totals[0]) * 1000) / 10}%)`
                  : "";
              })()}
            </div>
          )}
          <div className="text-gray-700">
            {breakEvenText(result, trip.distance_km, hasKmLimit)}
          </div>
          {trip.people_count > 0 && (
            <div className="text-gray-700">
              Chia {trip.people_count} người:{" "}
              {result.options
                .map(
                  (option, index) =>
                    `${option.name || `Phương án ${index + 1}`} ${formatCurrency(option.per_person_cost)}/người`
                )
                .join(" · ")}
            </div>
          )}
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 border border-slate-300 rounded-lg text-gray-700 hover:bg-slate-50"
          >
            Copy kết quả
          </button>
          {canSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : editing ? "Cập nhật" : "Lưu lại"}
            </button>
          )}
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Nhập lại
          </button>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Kiểm chứng bài toán gốc bằng mắt**

Run: `cd FRONTEND && npm run dev` (backend chạy song song)

Mở `/car-rental`, tab Tính toán. Form đã điền sẵn Xe xăng / Xe điện. Nhập **Tổng km = 800**, **Số ngày = 2**, rồi kiểm bảng kết quả khớp đúng:

| Phương án | Thuê | Nhiên liệu | Tổng | đ/km |
|---|---:|---:|---:|---:|
| Xe xăng | 1.000.000 | 1.680.000 | 2.680.000 | 3.350 |
| Xe điện | 1.380.000 | 0 | 1.380.000 | 1.725 |

Và các dòng dưới bảng:
- "Tiết kiệm 1.300.000 ₫ (−48,5%)"
- "Đi trên 181 km thì Xe điện rẻ hơn."
- Badge "Rẻ nhất" nằm ở dòng Xe điện

- [ ] **Step 3: Kiểm chứng các nhánh còn lại bằng mắt**

1. Đổi Tổng km về **100** → câu hòa vốn phải đổi thành "Đi **dưới** 181 km thì **Xe xăng** rẻ hơn." và badge Rẻ nhất nhảy sang Xe xăng.
2. Nhập **Số người = 8** → hiện dòng "Chia 8 người: Xe xăng 335.000 ₫/người · Xe điện 172.500 ₫/người".
3. Tick **Nâng cao**, đặt Giới hạn km/ngày = 300 và Phí vượt = 4.000 cho cả 2 phương án, Tổng km = 800 → cột "Vượt km" hiện 800.000 ở cả 2 dòng, và câu hòa vốn có đuôi "(chưa tính phí vượt km)".
4. Bấm **+ Thêm phương án** → câu hòa vốn đổi thành "Điểm hòa vốn chỉ tính được khi so đúng 2 phương án."
5. Bấm **Xóa** để về 2 phương án → nút Xóa biến mất khi chỉ còn 2.
6. Bấm **Copy kết quả** → dán vào đâu đó, kiểm text đọc được.
7. Bấm **Lưu lại** → chuyển sang tab Lịch sử (nội dung tab còn rỗng ở task này, đó là bình thường).

Sau bước 7, kiểm dữ liệu đã xuống DB:
```bash
cd BACKEND && php artisan tinker --execute="\$c = App\Models\CarRentalComparison::latest('id')->with('options')->first(); echo \$c->break_even_km . ' | ' . \$c->options->pluck('total_cost')->implode(', ');"
```
Expected: in ra `181 | 2680000, 1380000`

- [ ] **Step 4: Lint**

Run: `cd FRONTEND && npm run lint`
Expected: không có lỗi mới

- [ ] **Step 5: Commit**

```bash
git add FRONTEND/src/screens/car-rental/CarRentalCalculator.jsx
git commit -m "feat(car-rental): màn hình tính và so sánh chi phí thuê xe"
```

---

### Task 8: Tab Lịch sử

**Files:**
- Modify: `FRONTEND/src/screens/car-rental/CarRentalHistory.jsx` (thay toàn bộ nội dung rỗng từ Task 6)

**Interfaces:**
- Consumes: `carRentalsApi.getAll()`, `carRentalsApi.delete(id)` (Task 6); `formatCurrency`, `formatNumber`, `formatDateDisplay` từ `../../utils/formatters`; `useAuth`
- Produces: component nhận `{ reloadKey, onEdit }`; gọi `onEdit(comparison)` khi bấm "Nạp vào máy tính"

- [ ] **Step 1: Viết toàn bộ component**

Thay toàn bộ `FRONTEND/src/screens/car-rental/CarRentalHistory.jsx` bằng:

```jsx
import { useCallback, useEffect, useState } from "react";
import { carRentalsApi } from "../../services/api";
import { formatCurrency, formatDateDisplay, formatNumber } from "../../utils/formatters";
import { useAuth } from "../../contexts/AuthContext";

export default function CarRentalHistory({ reloadKey, onEdit }) {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await carRentalsApi.getAll();
      setItems(response.data ?? []);
    } catch {
      setError("Không tải được lịch sử. Thử lại giúp mình.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const handleDelete = async (item) => {
    const label = item.name || `bản ghi #${item.id}`;
    if (!window.confirm(`Xóa ${label}?`)) return;

    setDeletingId(item.id);
    try {
      await carRentalsApi.delete(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch {
      setError("Không xóa được. Thử lại giúp mình.");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return <div className="text-gray-600 py-8 text-center">Đang tải...</div>;
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <div className="text-red-600 mb-3">{error}</div>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-gray-600 py-8 text-center">
        Chưa có lần so sánh nào được lưu.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const cheapest = (item.options ?? []).find((option) => option.is_cheapest);
        const expanded = expandedId === item.id;

        return (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : item.id)}
              className="w-full text-left p-4 hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-gray-900">
                  {item.name || `Bản ghi #${item.id}`}
                </span>
                <span className="text-sm text-gray-500">
                  {item.date ? formatDateDisplay(item.date) : "Không ghi ngày"}
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {item.days} ngày · {formatNumber(item.distance_km)} km
                {cheapest && (
                  <>
                    {" · Rẻ nhất: "}
                    <span className="text-green-700 font-medium">
                      {cheapest.name} {formatCurrency(cheapest.total_cost)}
                    </span>
                  </>
                )}
                {item.saving_amount > 0 && ` · Tiết kiệm ${formatCurrency(item.saving_amount)}`}
              </div>
            </button>

            {expanded && (
              <div className="px-4 pb-4 border-t border-slate-100">
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-slate-200">
                        <th className="py-2 pr-3">Phương án</th>
                        <th className="py-2 px-3 text-right">Thuê</th>
                        <th className="py-2 px-3 text-right">Nhiên liệu</th>
                        <th className="py-2 px-3 text-right">Vượt km</th>
                        <th className="py-2 px-3 text-right">Khác</th>
                        <th className="py-2 px-3 text-right">Tổng</th>
                        <th className="py-2 pl-3 text-right">đ/km</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.options ?? []).map((option) => (
                        <tr
                          key={option.id}
                          className={`border-b border-slate-100 ${option.is_cheapest ? "bg-green-50" : ""}`}
                        >
                          <td className="py-2 pr-3 font-medium text-gray-900">{option.name}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(option.rental_cost)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(option.fuel_cost)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(option.over_km_cost)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(option.extra_fixed_cost)}</td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {formatCurrency(option.total_cost)}
                          </td>
                          <td className="py-2 pl-3 text-right">{formatCurrency(option.cost_per_km)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-sm text-gray-600 space-y-1">
                  {item.break_even_km !== null && (
                    <div>Điểm hòa vốn: {formatNumber(item.break_even_km)} km</div>
                  )}
                  {item.people_count > 0 && <div>Chia {item.people_count} người</div>}
                  {item.note && <div>Ghi chú: {item.note}</div>}
                  {item.creator && <div>Người tạo: {item.creator.name}</div>}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {hasPermission("car_rentals.update") && (
                    <button
                      type="button"
                      onClick={() => onEdit?.(item)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-gray-700 hover:bg-slate-50"
                    >
                      Nạp vào máy tính
                    </button>
                  )}
                  {hasPermission("car_rentals.delete") && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      {deletingId === item.id ? "Đang xóa..." : "Xóa"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Kiểm chứng bằng mắt**

Run: `cd FRONTEND && npm run dev` (backend chạy song song)

1. Mở `/car-rental` tab **Lịch sử** → thấy bản ghi đã lưu ở Task 7, dòng tóm tắt ghi "2 ngày · 800 km · Rẻ nhất: Xe điện 1.380.000 ₫ · Tiết kiệm 1.300.000 ₫".
2. Bấm vào bản ghi → mở rộng, bảng chi tiết khớp đúng bảng ở Task 7, dòng "Điểm hòa vốn: 181 km".
3. Bấm **Nạp vào máy tính** → nhảy sang tab Tính toán, form đã điền đúng dữ liệu cũ, có banner vàng "Đang sửa bản ghi đã lưu trước đó."
4. Đổi Tổng km thành 400, bấm **Cập nhật** → quay lại tab Lịch sử, bản ghi hiện 400 km, **và vẫn chỉ có 1 bản ghi** (không tạo bản mới).
5. Bấm **Hủy sửa** ở tab Tính toán → banner vàng biến mất, form về mặc định.
6. Bấm **Xóa** → xác nhận → bản ghi biến mất, hiện "Chưa có lần so sánh nào được lưu."

Kiểm dữ liệu đã sạch:
```bash
cd BACKEND && php artisan tinker --execute="echo App\Models\CarRentalComparison::count() . ' / ' . App\Models\CarRentalOption::count();"
```
Expected: in ra `0 / 0` (options bị xóa theo, xác nhận cascade hoạt động)

- [ ] **Step 3: Chạy toàn bộ test và lint lần cuối**

Run:
```bash
cd BACKEND && php artisan test
cd ../FRONTEND && npm test && npm run lint
```
Expected: backend PASS toàn bộ, frontend 13 tests PASS, lint không lỗi mới

- [ ] **Step 4: Xác nhận `vite.config.js` không bị commit**

Run: `git status --short`
Expected: `FRONTEND/vite.config.js` vẫn ở trạng thái ` M` chưa staged, và không xuất hiện trong bất kỳ commit nào của 8 task này.

Kiểm lại toàn bộ lịch sử vừa tạo:
```bash
git log --oneline -8 --name-only | grep vite.config.js || echo "OK: vite.config.js không nằm trong commit nào"
```
Expected: in ra `OK: vite.config.js không nằm trong commit nào`

- [ ] **Step 5: Commit**

```bash
git add FRONTEND/src/screens/car-rental/CarRentalHistory.jsx
git commit -m "feat(car-rental): tab lịch sử so sánh, nạp lại và xóa bản ghi"
```

---

## Bản đồ đối chiếu spec → task

| Mục spec | Task |
|---|---|
| 3. Kiến trúc và luồng dữ liệu | 1, 3, 5, 7 |
| 4. Công thức (chi phí, rẻ nhất, hòa vốn) | 1 (PHP), 5 (JS) |
| 5. Mô hình dữ liệu | 2 |
| 6. API | 3 |
| 7. Phân quyền | 4 (seeder), 6-8 (gác ở frontend) |
| 8. Frontend | 6 (nối dây), 7 (tính toán), 8 (lịch sử) |
| 9. Test | 1, 2, 3 (backend), 5 (frontend) |
| 10. Rủi ro: công thức 2 nơi | 1 + 5 dùng chung bộ số kỳ vọng |
| 10. Rủi ro: hòa vốn bỏ qua phí vượt km | 7 Step 3.3 (kiểm chứng ghi chú hiện ra) |
| 10. Rủi ro: nhầm km 1 chiều/2 chiều | 7 (nhãn "Tổng km (cả đi lẫn về)") |
| 11. Việc tồn đọng phân quyền backend | Ngoài phạm vi, cố ý không làm |
