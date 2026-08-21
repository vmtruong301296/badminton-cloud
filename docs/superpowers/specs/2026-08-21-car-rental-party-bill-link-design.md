# Thiết kế: gắn lần thuê xe vào bill tiệc

Ngày: 2026-08-21
Trạng thái: đã duyệt thiết kế, chờ review spec
Liên quan: `2026-08-21-car-rental-cost-comparison-design.md`

## 1. Mục tiêu

Mỗi lần thuê xe có thể gắn vào **tối đa một** bill tiệc, hoặc không gắn.
Khi đã gắn, chi phí chuyến đi hiện thành một dòng chi phí thêm bên bill
tiệc (`tên chuyến đi` = `số tiền`) và được chia cho người tham gia theo
đúng cơ chế sẵn có của bill tiệc.

Liên kết là **sống**: sửa lần thuê xe thì bill tiệc tự cập nhật theo.

## 2. Vì sao việc này rủi ro

Chi phí thêm của bill tiệc không nằm yên một chỗ. Luồng tiền hiện tại:

```
total_extra   = Σ extras.amount
total_amount  = base_amount + total_extra
unit_price    = round(total_amount / Σ ratio_value)
share_amount  = round(ratio_value × unit_price)      ← tiền của TỪNG NGƯỜI
participant.total_amount = share_amount + food_amount − paid_amount
```

Thêm một dòng chi phí thêm là đổi số tiền phải trả của **mọi người tham
gia**. Mọi thay đổi dưới đây phải giữ nguyên tính đúng đắn của chuỗi này.

### Quả mìn đã phát hiện

`PartyBillController::update()` hiện xóa sạch rồi dựng lại extras từ
payload:

```php
$partyBill->extras()->delete();
$partyBill->participants()->delete();
// ... rồi tạo lại từ $request->extras
```

Nếu bên thuê xe đẩy một dòng sang, rồi ai đó sửa bill tiệc từ màn bill
tiệc, dòng đó **bị xóa sạch** — âm thầm mất tiền xe khỏi bill. Đây là
vấn đề trung tâm mà thiết kế này phải giải quyết.

Cùng nguồn gốc: `FRONTEND/src/screens/party/EditPartyBill.jsx` dòng
96–102 nạp **toàn bộ** extras vào form sửa, dòng 280–282 gửi lại tất cả.

## 3. Mô hình dữ liệu

### `car_rental_comparisons` — thêm 2 cột

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `party_bill_id` | foreignId party_bills, nullable, **nullOnDelete** | null = không gắn |
| `selected_sort_order` | unsignedInteger, nullable | phương án thực tế thuê; null = dùng phương án rẻ nhất |

`selected_sort_order` trỏ vào `car_rental_options.sort_order`, ổn định vì
options được dựng lại với `sort_order` = chỉ số mỗi lần lưu.

Xóa bill tiệc → `party_bill_id` về null, lần thuê xe **không** bị xóa.

### `party_bill_extras` — thêm 1 cột

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `car_rental_comparison_id` | foreignId car_rental_comparisons, nullable, cascadeOnDelete | khác null = dòng do thuê xe sở hữu |

Một bill tiệc nhận được **nhiều** lần thuê xe, mỗi lần một dòng riêng.

`cascadeOnDelete` chỉ là lưới an toàn cho thao tác xóa thẳng dưới DB.
Luồng bình thường phải gỡ liên kết **trước** khi xóa (mục 5), vì cascade
không kích hoạt việc tính lại tiền bill tiệc.

## 4. Tách `PartyBillRecalculator`

Phép tính ở mục 2 hiện bị chép hai lần, trong `PartyBillController::store()`
và `update()`. Thêm người gọi thứ ba là gần như chắc chắn sẽ lệch nhau về
sau, nên tách ra một chỗ:

```php
namespace App\Services;

class PartyBillRecalculator
{
    /**
     * Tính lại tổng và phần chia của từng người TỪ DỮ LIỆU TRONG DB.
     * Không đọc request: đây là điểm mấu chốt để dòng chi phí thêm do
     * thuê xe sở hữu luôn được tính vào, dù payload không hề biết đến nó.
     */
    public function recalculate(PartyBill $bill): PartyBill;

    /** Bill đã thanh toán hết (mọi người tham gia đều is_paid). */
    public function isFullyPaid(PartyBill $bill): bool;
}
```

`recalculate()` đọc `base_amount`, cộng **mọi** `extras` trong DB, cộng
`ratio_value` của mọi participant, rồi ghi lại `total_extra`,
`total_amount`, `unit_price`, và `share_amount` + `total_amount` của từng
participant.

Bắt buộc giữ nguyên: `paid_amount`, `food_amount`, `is_paid`, `paid_at`,
`note`, `user_id`, `ratio_value` của participant.

**Hành vi phải giữ y nguyên, không được "sửa cho đẹp":**
- `Σ ratio_value = 0` → `unit_price = 0` (không chia cho 0).
- Tổng các `share_amount` có thể lệch `total_amount` vài đồng do làm tròn
  từng dòng. Đây là hành vi sẵn có; thiết kế này **không** đụng vào.

`store()` và `update()` được sửa để gọi `recalculate()` thay vì tự tính.
Trước khi refactor phải có test phủ hành vi hiện tại (mục 8).

## 5. Đồng bộ liên kết

```php
namespace App\Services;

class CarRentalPartyBillLink
{
    /**
     * Đồng bộ dòng chi phí thêm cho một lần thuê xe, sau khi nó được
     * lưu. $previousBillId là bill tiệc TRƯỚC khi lưu, để gỡ khi đổi bill.
     *
     * @throws \App\Exceptions\PartyBillLockedException khi bill liên quan đã thanh toán hết
     */
    public function sync(CarRentalComparison $comparison, ?int $previousBillId): void;

    /** Gỡ dòng chi phí thêm, dùng khi xóa lần thuê xe. */
    public function detach(CarRentalComparison $comparison): void;
}
```

### Số tiền đẩy sang

Lấy `trip_total_cost` của phương án có `sort_order = selected_sort_order`.

Đường lui khi không tìm được (`selected_sort_order` là null, hoặc trỏ vào
một phương án đã bị xóa trong lần sửa sau): lấy phương án có
`is_cheapest = true`. Trường hợp này cũng ghi `selected_sort_order` về null
để dữ liệu không giữ một con trỏ chết.

`trip_total_cost` **đã bao gồm chi phí chung** của lần thuê xe (gửi xe,
trạm thu phí). Giao diện phải nhắc người dùng đừng gõ lại các khoản đó
thành dòng riêng bên bill tiệc (mục 7).

### Tên dòng

`name` = `comparison.name`. Nếu rỗng thì `"Chuyến xe #{id}"`.

### Thuật toán `sync()`

1. Nếu `previousBillId` khác `party_bill_id` hiện tại và khác null: xóa
   dòng extra thuộc comparison này ở bill cũ, rồi `recalculate()` bill cũ.
2. Nếu `party_bill_id` là null: dừng (đã gỡ ở bước 1).
3. Ngược lại: `updateOrCreate` dòng extra theo
   `['car_rental_comparison_id' => $comparison->id, 'party_bill_id' => $billId]`
   với `name` và `amount` ở trên, rồi `recalculate()` bill mới.

### Chốt chặn bill đã thanh toán hết

`PartyBillController::update()` hiện chặn sửa khi **mọi** participant đã
`is_paid` (403). Thiết kế này giữ nguyên bất biến đó: nếu `sync()` hoặc
`detach()` sẽ đụng vào một bill đã thanh toán hết — dù là bill cũ hay bill
mới — thì ném `PartyBillLockedException`, `CarRentalController` bắt và trả
**422** với thông điệp:

> `Bill tiệc «{tên}» đã thanh toán hết nên không sửa được. Hãy bỏ đánh dấu thanh toán của ít nhất một người trước khi gắn hoặc gỡ chuyến xe.`

Chặn cả khi **gỡ**, vì gỡ cũng làm đổi tiền của mọi người.

## 6. Thay đổi ở `PartyBillController`

### `update()`

```php
// Chỉ xóa dòng do người dùng tự nhập; dòng do thuê xe sở hữu giữ nguyên.
$partyBill->extras()->whereNull('car_rental_comparison_id')->delete();
```

Và **bỏ hoàn toàn** việc tính `total_extra` từ `$request->extras`; sau khi
dựng lại các dòng thủ công thì gọi `PartyBillRecalculator::recalculate()`.
Payload của màn bill tiệc không biết đến dòng do thuê xe sở hữu, nên tính
theo payload là mất tiền xe.

Dòng nào trong payload có `car_rental_comparison_id` khác null thì **bỏ
qua**, không tạo — chống việc client tự bịa ra dòng sở hữu.

### `store()`

Bill mới chưa thể có dòng do thuê xe sở hữu, nhưng vẫn chuyển sang gọi
`recalculate()` để hai đường đi dùng chung một phép tính.

### `destroy()`

Không cần sửa: `party_bill_id` trên comparison là `nullOnDelete`.

## 6b. Hợp đồng API của lần thuê xe

`StoreCarRentalComparisonRequest` và `UpdateCarRentalComparisonRequest` nhận
thêm hai trường:

```php
'party_bill_id' => 'nullable|integer|exists:party_bills,id',
'selected_sort_order' => 'nullable|integer|min:0',
```

Thông điệp lỗi tiếng Việt cho `party_bill_id.exists`:
*"Bill tiệc được chọn không tồn tại."*

`CarRentalController::persist()` đọc `party_bill_id` trước khi ghi để lấy
`previousBillId`, ghi hai trường mới cùng lúc với phần còn lại, rồi gọi
`CarRentalPartyBillLink::sync($comparison, $previousBillId)` **bên trong
cùng transaction** — nếu `sync()` ném `PartyBillLockedException` thì toàn
bộ lần lưu bị rollback, lần thuê xe cũng không đổi.

`CarRentalController::destroy()` gọi `detach()` **trước** khi xóa, cũng
trong transaction.

Response của `index`/`show`/`store`/`update` eager load thêm `partyBill`
(chỉ `id`, `name`, `date`) để giao diện hiện tên bill đã gắn.

Không thêm quyền mới: dùng nguyên nhóm `car_rentals.*` và `party_bills.*`
sẵn có. Backend vẫn chỉ chặn `auth` đúng theo pattern hiện hành của repo.

## 7. Giao diện

### Màn thuê xe — `CarRentalCalculator.jsx`

Thêm vào khối "Chuyến đi":

- **Gắn vào bill tiệc** — `<select>` nạp từ `partyBillsApi.getAll()`, mục
  đầu là `— Không gắn —`. Hiển thị `tên bill` + `ngày`.
- **Xe thực tế thuê** — `<select>` các phương án, **chỉ hiện khi đã chọn
  bill tiệc**. Mặc định là phương án rẻ nhất.

Khi đã gắn:

- **Thay** khối "Chia N người" bằng dòng:
  *"Tiền xe được chia qua bill tiệc «{tên}»"* kèm link tới
  `/party-bills/{id}`. Để hai con số "mỗi người" khác nhau trên hai màn
  hình là mời gọi nhầm lẫn.
- Nếu lần thuê xe có chi phí chung > 0, hiện nhắc nhở:
  *"Số đẩy sang đã gồm chi phí chung ({số tiền}) — đừng gõ lại gửi xe /
  trạm thu phí thành dòng riêng bên bill tiệc."*

### Màn bill tiệc

`PartyBillDetail.jsx` (dòng 809–820): dòng extra có
`car_rental_comparison_id` hiện thêm icon 🚗 và link tới `/car-rental`.

`EditPartyBill.jsx` (dòng 96–102 và 280–282):
- Khi nạp form, **lọc bỏ** dòng có `car_rental_comparison_id` khỏi
  `form.extras`, giữ riêng trong `lockedExtras` để hiển thị.
- Hiện `lockedExtras` thành các dòng **chỉ đọc**, icon 🚗, không có nút
  xóa, kèm chú thích *"đến từ màn Thuê xe"* và link.
- Payload gửi lên **không** chứa các dòng này.

`CreatePartyBill.jsx`: không đổi (bill mới chưa thể có dòng sở hữu).

### Màn lịch sử thuê xe — `CarRentalHistory.jsx`

Mỗi bản ghi có gắn bill tiệc thì hiện thêm tên bill tiệc + link.

## 8. Test

### Bước khóa hành vi trước khi refactor

Trước khi tách `PartyBillRecalculator`, viết
`tests/Feature/PartyBillMoneyTest.php` phủ hành vi **hiện tại** của
`store()` và `update()`: `total_extra`, `total_amount`, `unit_price`,
`share_amount` và `total_amount` của từng participant, ca
`Σ ratio_value = 0`, và ca bill đã thanh toán hết trả 403. Bộ test này
phải xanh **trước** và **sau** khi refactor, không sửa kỳ vọng.

### `tests/Unit/PartyBillRecalculatorTest.php`

- Tính đúng `unit_price` và share với tỉ lệ lẻ (1, 0.5, 1.5)
- `Σ ratio_value = 0` → `unit_price = 0`, không chia cho 0
- Giữ nguyên `paid_amount`, `food_amount`, `is_paid`, `paid_at`
- `participant.total_amount = share + food − paid`, cho phép âm
- Cộng cả dòng extra do thuê xe sở hữu lẫn dòng thủ công

### `tests/Feature/CarRentalPartyBillLinkTest.php`

| Ca | Kỳ vọng |
|---|---|
| Gắn xe vào bill | Tạo 1 extra sở hữu; `total_extra`, `unit_price`, share **từng người** đúng |
| Sửa lần thuê xe (đổi km) | Extra cập nhật số tiền; bill tính lại |
| Đổi `selected_sort_order` | Extra lấy `trip_total_cost` của đúng phương án đó |
| Không chọn phương án | Lấy phương án `is_cheapest` |
| Đổi sang bill tiệc khác | Gỡ khỏi bill cũ **và** tính lại **cả hai** bill |
| Bỏ gắn (`party_bill_id = null`) | Xóa extra, bill tính lại |
| Xóa lần thuê xe | Xóa extra, bill tính lại |
| **Sửa bill tiệc từ màn bill tiệc** | Dòng sở hữu **không bị xóa**, `total_extra` vẫn gồm nó |
| Payload bill tiệc bịa `car_rental_comparison_id` | Bỏ qua, không tạo dòng sở hữu giả |
| Bill đích đã thanh toán hết | 422, thông điệp ở mục 5, **không** đổi gì trong DB |
| Bill nguồn đã thanh toán hết, thử gỡ | 422, không đổi gì |
| Xóa bill tiệc đang được gắn | `party_bill_id` về null, xóa bill thành công |
| Hai lần thuê xe cùng gắn một bill | Hai dòng extra riêng, tổng đúng |
| `selected_sort_order` trỏ vào phương án đã bị xóa | Lui về phương án rẻ nhất, ghi cột về null |
| `party_bill_id` không tồn tại | 422, `party_bill_id` có lỗi |
| `sync()` ném lỗi giữa chừng | Rollback toàn bộ: lần thuê xe **không** đổi, bill tiệc **không** đổi |

## 9. Rủi ro đã biết

| Rủi ro | Cách xử lý |
|---|---|
| Refactor code tiền đang chạy thật | Test khóa hành vi ở mục 8 chạy xanh trước và sau, không sửa kỳ vọng |
| Trùng lặp chi phí chung hai bên | Nhắc nhở trên giao diện; không chặn cứng vì người dùng có thể cố ý |
| Bill đã thanh toán hết bị khóa gây khó chịu | Thông điệp nói rõ cách xử lý: bỏ đánh dấu thanh toán một người |
| Lệch vài đồng do làm tròn từng share | Hành vi sẵn có, cố ý không đụng; ghi rõ ở mục 4 |
| Client tự bịa dòng extra sở hữu | Backend bỏ qua mọi `car_rental_comparison_id` đến từ payload bill tiệc |
