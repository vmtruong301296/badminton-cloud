# Thiết kế: So sánh chi phí thuê xe xăng vs xe điện

Ngày: 2026-08-21
Trạng thái: đã duyệt thiết kế, chờ implementation plan

## 1. Bối cảnh và mục tiêu

CLB thường thuê xe tự lái khi đi giao lưu tỉnh. Quyết định thuê xe xăng hay
xe điện hiện được tính tay, mỗi lần một kiểu, và dễ bỏ sót các khoản chi phí
thật (phí vượt giới hạn km, phí giao xe, bảo hiểm).

Mục tiêu: một màn hình nhập thông số chuyến đi và các phương án thuê xe, cho
ra bảng so sánh chi phí bóc tách từng khoản, chỉ ra phương án rẻ nhất, tính
điểm hòa vốn theo quãng đường, chia đầu người, và lưu lại lịch sử so sánh
dùng chung cho cả CLB.

### Bài toán mẫu dùng làm test case gốc

Chuyến 2 ngày, tổng quãng đường cả đi lẫn về 800km.

- Xe xăng: 500.000đ/ngày, 7 L/100km, giá xăng 30.000đ/lít
- Xe điện: 690.000đ/ngày, miễn phí sạc

Kết quả kỳ vọng:

| Khoản | Xe xăng | Xe điện |
|---|---:|---:|
| Thuê (2 ngày) | 1.000.000 | 1.380.000 |
| Nhiên liệu (800km) | 1.680.000 | 0 |
| Tổng | 2.680.000 | 1.380.000 |
| Chi phí/km | 3.350 | 1.725 |

Xe điện rẻ hơn 1.300.000đ (−48,5%). Điểm hòa vốn 181 km.

## 2. Phạm vi

### Trong phạm vi

- So sánh N phương án (tối thiểu 2, thêm/bớt được), không cố định 2.
- Tính điểm hòa vốn theo quãng đường khi so đúng 2 phương án.
- Ô nhập nâng cao: giới hạn km/ngày, phí vượt đ/km, chi phí cố định khác.
- Chia đầu người.
- Lưu lịch sử so sánh vào DB, dùng chung cả CLB, có phân quyền.
- Copy kết quả ra text để dán Zalo nhóm.

### Ngoài phạm vi (cắt có chủ ý)

- Không nối kết quả sang Bill tiệc.
- Không hiển thị bản đồ, trạm sạc, hay thời gian sạc.
- Không tự động lấy giá xăng từ nguồn ngoài.
- Không so sánh mua xe với thuê xe.

## 3. Kiến trúc và luồng dữ liệu

Frontend tính preview tức thì bằng JS thuần, không gọi API. Khi bấm Lưu,
frontend chỉ gửi input; backend tính lại từ đầu bằng service riêng rồi lưu cả
input lẫn kết quả của chính nó.

```
Người dùng gõ input
   |
   +--> carRentalCost.js (JS thuần) --> kết quả hiện ngay, KHÔNG gọi API
                                          |
        bấm "Lưu" -- gửi CHỈ input -------+
                          |
                          v
        CarRentalCalculator (PHP service) --> tính lại từ đầu
                          |
                          v
        Lưu input + kết quả (snapshot) vào DB
```

Hai quyết định đằng sau luồng này:

1. **Backend không tin số của frontend.** Client chỉ gửi input; mọi con số
   được lưu đều do backend tính.
2. **Kết quả lưu dạng snapshot.** Lịch sử cũ giữ nguyên con số tại thời điểm
   lưu, kể cả khi công thức thay đổi về sau.

Cái giá phải trả: công thức tồn tại ở hai nơi (JS và PHP). Chấp nhận đánh
đổi này để có preview không trễ mạng, và bù lại bằng test ở cả hai phía dùng
chung bộ số kỳ vọng.

## 4. Công thức

Áp dụng giống hệt nhau trong `carRentalCost.js` và `CarRentalCalculator.php`.

### Chi phí mỗi phương án

```
rental_cost     = rental_per_day * days
fuel_used       = distance_km * consumption_per_100 / 100
                  (= 0 nếu fuel_type = 'none')
fuel_cost       = round(fuel_used * fuel_unit_price)
                  (fuel_unit_price = 0 nghĩa là miễn phí)
included_km     = km_limit_per_day * days
                  (km_limit_per_day = null nghĩa là không giới hạn)
over_km         = max(0, distance_km - included_km)
                  (= 0 khi không giới hạn)
over_km_cost    = over_km * over_km_fee

total_cost      = rental_cost + fuel_cost + over_km_cost + extra_fixed_cost
cost_per_km     = distance_km > 0 ? round(total_cost / distance_km) : 0
per_person_cost = people_count > 0 ? round(total_cost / people_count) : 0
```

Mọi giá trị tiền là số nguyên đồng. Làm tròn bằng `round()` nửa lên.

### Phương án rẻ nhất

`is_cheapest = true` cho phương án có `total_cost` nhỏ nhất. Khi hòa nhau,
phương án có `sort_order` nhỏ hơn được đánh dấu. `saving_amount` trên bản ghi
so sánh = `total_cost` rẻ nhì − `total_cost` rẻ nhất.

### Điểm hòa vốn

Chỉ tính khi có **đúng 2** phương án. Ngoài ra `break_even_km = null`.

```
fixed_X = rental_per_day_X * days + extra_fixed_cost_X
var_X   = consumption_per_100_X / 100 * fuel_unit_price_X    (đ/km)

Nếu var_A == var_B  -> null   (hai phương án song song, không cắt nhau)
d = (fixed_B - fixed_A) / (var_A - var_B)
Nếu d <= 0          -> null   (điểm cắt nằm ngoài vùng hợp lệ)
break_even_km = round(d)
```

Đối chiếu bài toán mẫu: `(1.380.000 - 1.000.000) / (2.100 - 0) = 181,0 km`.

**Giới hạn đã biết:** công thức trên bỏ qua `over_km_cost`, vì phí vượt km là
hàm bậc thang làm bài toán mất tính tuyến tính. Khi người dùng có bật giới
hạn km, UI vẫn hiện điểm hòa vốn nhưng **bắt buộc kèm ghi chú "(chưa tính phí
vượt km)"**. Đây là giới hạn công khai, không được giấu.

Khi `break_even_km = null` mà một phương án luôn rẻ hơn, UI hiện câu dạng
"Xe điện rẻ hơn ở mọi quãng đường".

## 5. Mô hình dữ liệu

### Bảng `car_rental_comparisons`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | id | |
| `name` | string, nullable | ví dụ "Chuyến Đà Lạt" |
| `date` | date, nullable | ngày đi |
| `days` | unsignedInteger | số ngày thuê, >= 1 |
| `distance_km` | unsignedInteger | tổng km cả đi lẫn về |
| `people_count` | unsignedInteger, default 0 | 0 = không chia đầu người |
| `note` | text, nullable | |
| `break_even_km` | unsignedInteger, nullable | null khi không có nghiệm |
| `saving_amount` | unsignedBigInteger, default 0 | chênh lệch rẻ nhất vs rẻ nhì |
| `created_by` | foreignId users, nullOnDelete | theo pattern `party_bills` |
| `timestamps` | | |

### Bảng `car_rental_options`

Input:

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | id | |
| `car_rental_comparison_id` | foreignId, cascadeOnDelete | |
| `name` | string | "Xe xăng", "Xe điện" |
| `sort_order` | unsignedInteger, default 0 | |
| `rental_per_day` | unsignedBigInteger | |
| `fuel_type` | string(20) | `petrol` / `electric` / `none` |
| `consumption_per_100` | decimal(8,2), default 0 | L/100km hoặc kWh/100km |
| `fuel_unit_price` | unsignedInteger, default 0 | đ/L hoặc đ/kWh; 0 = miễn phí |
| `extra_fixed_cost` | unsignedBigInteger, default 0 | bảo hiểm, phí giao xe, tài xế |
| `km_limit_per_day` | unsignedInteger, nullable | null = không giới hạn |
| `over_km_fee` | unsignedInteger, default 0 | đ/km vượt |

Kết quả do backend tính và lưu snapshot:

| Cột | Kiểu |
|---|---|
| `rental_cost` | unsignedBigInteger, default 0 |
| `fuel_cost` | unsignedBigInteger, default 0 |
| `over_km_cost` | unsignedBigInteger, default 0 |
| `total_cost` | unsignedBigInteger, default 0 |
| `cost_per_km` | unsignedInteger, default 0 |
| `per_person_cost` | unsignedInteger, default 0 |
| `is_cheapest` | boolean, default false |

Dùng cờ `is_cheapest` trên option thay vì khóa ngoại `cheapest_option_id`
trên bảng comparison, để tránh khóa ngoại vòng tròn giữa hai bảng.

## 6. API

Đặt trong nhóm `Route::middleware('auth')` sẵn có tại `BACKEND/routes/api.php`.

| Method | Đường dẫn | Action |
|---|---|---|
| GET | `/api/car-rentals` | index |
| POST | `/api/car-rentals` | store |
| GET | `/api/car-rentals/{id}` | show |
| PUT | `/api/car-rentals/{id}` | update |
| DELETE | `/api/car-rentals/{id}` | destroy |

Backend chỉ chặn `auth`, **không kiểm tra quyền ở tầng server**, đúng theo
cách cả 14 controller hiện có trong repo đang làm. Quyền được gác ở frontend
(`ProtectedRoute` và lọc menu trong `Layout.jsx`). Xem mục 10 về giới hạn đã
biết của cách làm này.

`index` trả về kèm `options` và `creator`, sắp xếp `date desc, created_at desc`
giống `PartyBillController::index`.

`store` và `update` bọc trong `DB::transaction`. `update` xóa toàn bộ options
cũ rồi tạo lại từ input mới, giống cách `PartyBillController` xử lý `extras`.

Không có endpoint `calculate` không lưu. Frontend đã tự tính preview, và
service PHP được test trực tiếp bằng unit test.

### Validation (FormRequest)

`StoreCarRentalComparisonRequest` và `UpdateCarRentalComparisonRequest`:

- `days`: required, integer, min 1
- `distance_km`: required, integer, min 0
- `people_count`: nullable, integer, min 0
- `options`: required, array, min 2
- `options.*.name`: required, string, max 255
- `options.*.rental_per_day`: required, integer, min 0
- `options.*.fuel_type`: required, in `petrol,electric,none`
- `options.*.consumption_per_100`: nullable, numeric, min 0
- `options.*.fuel_unit_price`: nullable, integer, min 0
- `options.*.extra_fixed_cost`: nullable, integer, min 0
- `options.*.km_limit_per_day`: nullable, integer, min 1
- `options.*.over_km_fee`: nullable, integer, min 0
- `name`, `note`: nullable, string
- `date`: nullable, date

## 7. Phân quyền

Thêm nhóm `car_rentals` vào `BACKEND/database/seeders/RolePermissionSeeder.php`:

```php
['name' => 'car_rentals.view',   'display_name' => 'Xem so sánh thuê xe',  'group' => 'car_rentals'],
['name' => 'car_rentals.create', 'display_name' => 'Tạo so sánh thuê xe',  'group' => 'car_rentals'],
['name' => 'car_rentals.update', 'display_name' => 'Sửa so sánh thuê xe',  'group' => 'car_rentals'],
['name' => 'car_rentals.delete', 'display_name' => 'Xóa so sánh thuê xe',  'group' => 'car_rentals'],
```

Gán sẵn cả 4 quyền cho role `admin`. Các role khác để người dùng tự gán qua
màn hình Quyền.

Bốn quyền này được frontend dùng để ẩn/hiện menu và chặn route. Backend
không đọc chúng — xem mục 6 và mục 10.

Lịch sử **dùng chung cả CLB**: `index` không lọc theo `created_by`, đúng như
`party_bills` đang làm.

## 8. Frontend

| File | Vai trò |
|---|---|
| `FRONTEND/src/utils/carRentalCost.js` | công thức thuần, không phụ thuộc React |
| `FRONTEND/src/screens/car-rental/CarRentalComparison.jsx` | vỏ chứa 2 tab |
| `FRONTEND/src/screens/car-rental/CarRentalCalculator.jsx` | tab Tính toán |
| `FRONTEND/src/screens/car-rental/CarRentalHistory.jsx` | tab Lịch sử |
| `FRONTEND/src/services/api.js` | thêm `carRentalsApi` |
| `FRONTEND/src/App.jsx` | route `/car-rental`, guard `car_rentals.view` |
| `FRONTEND/src/components/Layout.jsx` | item sidebar 🚗 "Thuê xe" |

### Giá trị mặc định

Form mở lên đã có sẵn 2 phương án khớp bài toán mẫu:

- Xe xăng: 500.000đ/ngày, `petrol`, 7 L/100km, 30.000đ/L
- Xe điện: 690.000đ/ngày, `electric`, 0 kWh/100km, 0đ/kWh (miễn phí sạc)

Số ngày mặc định 2, quãng đường mặc định 0 để người dùng tự nhập.

### Bố cục

Các ô `km_limit_per_day`, `over_km_fee`, `extra_fixed_cost` nằm trong mục
"Nâng cao" thu gọn, mặc định đóng, để form không rối với ca dùng thường gặp.

Khu vực kết quả hiển thị theo thứ tự:

1. Bảng bóc tách từng khoản của từng phương án, cột cuối là Tổng và đ/km.
2. Badge "Rẻ nhất" trên phương án thắng, kèm chênh lệch tuyệt đối và phần trăm.
3. Câu điểm hòa vốn, kèm ghi chú "(chưa tính phí vượt km)" khi có bật giới hạn km.
4. Chia đầu người, ẩn khi `people_count = 0`.
5. Nút Copy kết quả ra text thuần để dán Zalo nhóm.

Định dạng tiền theo đúng cách các màn hình hiện có trong repo đang làm.

## 9. Test

### Backend

`BACKEND/tests/Unit/CarRentalCalculatorTest.php`:

- Bài toán mẫu 800km/2 ngày ra đúng 2.680.000 / 1.380.000, `saving_amount`
  1.300.000, `break_even_km` 181, `cost_per_km` 3.350 / 1.725.
- Xe điện sạc trả phí (18 kWh/100km, 3.858đ/kWh) ra 1.935.552.
- Vượt giới hạn km: cap 300km/ngày, phí 4.000đ/km, 800km/2 ngày ra
  `over_km_cost` 800.000 cho cả hai phương án.
- `distance_km = 0` không chia cho 0, `cost_per_km` = 0.
- `people_count = 0` không chia cho 0, `per_person_cost` = 0.
- Ba phương án trở lên: `break_even_km` = null, `is_cheapest` vẫn đúng.
- Hai phương án cùng `var` (không có nghiệm): `break_even_km` = null.
- Hòa `total_cost`: phương án `sort_order` nhỏ hơn được đánh `is_cheapest`.

`BACKEND/tests/Feature/CarRentalControllerTest.php`:

- CRUD đầy đủ qua HTTP.
- Backend tính lại và bỏ qua số client gửi lên: gửi kèm `total_cost` sai,
  bản ghi lưu vẫn ra con số đúng.
- Chưa đăng nhập gọi API bị 401.
- `options` ít hơn 2 phần tử bị 422.

### Frontend

Cài `vitest` làm devDependency và thêm script `npm test` vào
`FRONTEND/package.json`.

`FRONTEND/src/utils/carRentalCost.test.js` chạy đúng bộ số kỳ vọng như
`CarRentalCalculatorTest.php`, để hai phía không bao giờ lệch nhau.

Vitest chỉ là devDependency, không ảnh hưởng bundle production.

## 10. Rủi ro đã biết

| Rủi ro | Cách xử lý |
|---|---|
| Công thức tồn tại ở 2 ngôn ngữ, dễ lệch | Test hai phía dùng chung bộ số kỳ vọng ở mục 9 |
| Điểm hòa vốn không tính phí vượt km | Ghi chú bắt buộc trên UI khi có bật giới hạn km |
| Người dùng nhầm quãng đường 1 chiều với 2 chiều | Nhãn ô nhập ghi rõ "tổng km cả đi lẫn về" |
| Backend không kiểm tra quyền, ai đăng nhập cũng gọi được API | Đã biết và chấp nhận để nhất quán với 14 controller hiện có. Đây là lỗ hổng sẵn có của toàn app, không riêng chức năng này — cần một việc riêng để vá đồng loạt, xem mục 11 |

## 11. Việc tồn đọng ngoài phạm vi

**Backend không có bất kỳ lớp kiểm tra quyền nào.** `User::hasPermission()`
tồn tại nhưng không controller hay middleware nào gọi tới. Cả 5 route mới lẫn
toàn bộ route cũ (`bills`, `party-bills`, `players`, `roles`, ...) chỉ chặn
`auth`. Bất kỳ tài khoản đã đăng nhập nào cũng có thể gọi thẳng mọi API bằng
`curl`, kể cả xóa bill hay sửa phân quyền, dù giao diện đã ẩn nút.

Vá triệt để cần một middleware `CheckPermission` áp đồng loạt cho mọi route,
kèm rà soát dữ liệu quyền trên production để không khóa nhầm người đang dùng.
Việc này cố ý để ngoài phạm vi chức năng so sánh thuê xe.
