# Thiết kế: đồng bộ giá xăng E10 RON 95-III

Ngày: 2026-08-21
Trạng thái: đã duyệt hướng tiếp cận, chờ review spec
Phụ lục của: `2026-08-21-car-rental-cost-comparison-design.md`

> **Cập nhật 2026-11-19:** giavangnay.com chết từ cuối 09/2026 (HTTP 530,
> Cloudflare 1016), quy tắc hai nguồn giữ giá đứng yên 56 ngày. Thay bằng API
> bảng giá bán lẻ của Petrolimex (mục 5). `source_date` giờ là ngày Petrolimex
> điều chỉnh giá; nguồn lỗi được ghi log (mục 6).

## 1. Mục tiêu và ràng buộc

Ô "Đơn giá xăng" trong màn hình so sánh thuê xe hiện phải gõ tay, và giá
mặc định 30.000 đ/lít đã lệch xa thực tế (giá thật ngày 21/08/2026 là
22.660 đ/lít). Mục tiêu: tự động lấy giá thị trường làm gợi ý điền sẵn.

### Kết quả khảo sát nguồn dữ liệu

| Nguồn | Máy đọc được | Có E10 RON 95-III | Kết luận |
|---|---|---|---|
| API chính thức Petrolimex | Không tồn tại | — | Loại |
| API bảng giá nội bộ của trang petrolimex.com.vn (tìm ra 2026-11-19) | JSON | Có | **Dùng** từ 2026-11-19 |
| HTML trang chủ petrolimex.com.vn | Bảng giá nạp bằng JS từ API ở dòng trên | Chỉ tên sản phẩm | Loại |
| Thông cáo chính thức Petrolimex | Bảng giá là ảnh JPG | Có, trong ảnh | Loại, cần OCR |
| VietFuelAPI (cộng đồng) | Đã chết, DNS không resolve | — | Loại |
| webgia.com | HTML table | Dòng RON 95 rỗng | Loại, đang hỏng ngầm |
| baohatinh.vn | meta description | Có | **Dùng** |
| giavangnay.com | HTML table | Có | Dùng tới 09/2026, **bỏ** vì đã chết (HTTP 530) |
| pvoil.com.vn (khảo sát 2026-11-19) | Chặn bằng thử thách Cloudflare (403) | — | Loại |

Hai nguồn được chọn cho cùng một con số 22.660 tại thời điểm khảo sát.
Ngày 2026-11-19, baohatinh.vn và API Petrolimex cùng cho 19.840.

### Ràng buộc bắt buộc

- **Không có nguồn chính thức máy đọc được.** Mọi thứ dưới đây là cào web
  bên thứ ba, và phải thiết kế với giả định nguồn sẽ hỏng. API Petrolimex
  dùng từ 2026-11-19 là API nội bộ của trang, không công bố, không cam kết,
  nên giả định này vẫn giữ nguyên.
- **Frontend không tự fetch được.** CORS chặn, và Worker Cloudflare chỉ
  proxy `/api` về Render. Mọi lần lấy giá chạy ở Laravel.
- **Render free tier không chạy cron.** `render.yaml` khai báo
  `type: web, plan: free`, không có worker service, instance ngủ khi rảnh.
  Nên dùng fetch theo yêu cầu + cache, không dùng scheduler.
- **Giá điều chỉnh mỗi thứ Năm** (quan sát: 13/8/2026 và 20/8/2026 đều là
  thứ Năm), nên dữ liệu quá 10 ngày là chắc chắn đã lỡ ít nhất một kỳ.

## 2. Nguyên tắc an toàn: hai nguồn phải khớp

Đây là trục chính của thiết kế. Một con số cào sai sẽ đi thẳng vào phép
tính tiền, nên hệ thống phải **không bao giờ tự tin sai**.

```
                  ┌─ petrolimex.com.vn ─┐
Yêu cầu làm mới ──┤                     ├─→ hai số BẰNG NHAU?
                  └─ baohatinh.vn ──────┘         │
                                                  ├─ Có ──→ cập nhật giá, ghi nguồn + thời điểm
                                                  │
                                                  └─ Không, hoặc một/cả hai nguồn lỗi
                                                         └─→ GIỮ NGUYÊN giá cũ,
                                                             ghi last_error + log, gắn cờ cần kiểm tra
```

Bốn quy tắc không được vi phạm:

1. **Chỉ cập nhật khi hai nguồn cho kết quả bằng nhau tuyệt đối.** Giá xăng
   là số nguyên do nhà nước công bố toàn quốc, không có lý do gì để hai
   nguồn lệch nhau. Lệch nghĩa là có nguồn sai.
2. **Kiểm tra khoảng hợp lệ 10.000–60.000 đ/lít** trước khi chấp nhận bất
   kỳ số nào. Chặn trường hợp parser bắt nhầm số khác trên trang (khảo sát
   đã gặp: trang chủ Petrolimex có số `20.346` là lượng khí thải CO, không
   phải giá).
3. **Thất bại không bao giờ ghi đè giá cũ.** Giá cũ ở nguyên đó, kèm lý do
   thất bại để hiển thị cho người dùng.
4. **Giá luôn là gợi ý, người dùng sửa đè được.** Không có đường nào để
   một con số cào được tự quyết định phép tính.

## 3. Kiến trúc

```
Màn hình so sánh mở
   └─> GET /api/fuel-prices   (chạy nền, KHÔNG chặn form)
            │
            v
     FuelPriceService::current($fuelKey)
            │
     Cache 6 giờ còn hạn? ──Có──> trả giá đã cache
            │ Không
            v
     Gọi song song 2 nguồn, mỗi nguồn timeout 5 giây
            │
     Áp quy tắc "hai nguồn phải khớp" ở mục 2
            │
     Ghi bảng fuel_prices, cache 6 giờ, trả về
```

Frontend nhận giá kèm nguồn và thời điểm, dùng làm giá mặc định cho các
phương án chạy xăng **chỉ khi form đang ở trạng thái mới** (không phải khi
nạp lại một bản ghi đã lưu), và luôn hiển thị dòng xuất xứ kèm nút
"Dùng giá này".

## 4. Mô hình dữ liệu

### Bảng `fuel_prices`

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `id` | id | |
| `fuel_key` | string(50), unique | `e10_ron95_iii` |
| `price` | unsignedInteger | đ/lít |
| `sources` | json, nullable | `{"baohatinh.vn":22660,"petrolimex.com.vn":22660}` (MySQL tự sắp key, thứ tự không có nghĩa) |
| `source_date` | date, nullable | ngày Petrolimex điều chỉnh giá (`LastModified`, giờ Việt Nam) |
| `fetched_at` | timestamp, nullable | lần cào **thành công** gần nhất |
| `last_checked_at` | timestamp, nullable | lần **thử** gần nhất, kể cả thất bại |
| `last_error` | string(255), nullable | lý do lần thử gần nhất thất bại |
| `updated_by` | foreignId users, nullOnDelete | có giá trị khi admin sửa tay |
| `timestamps` | | |

Một dòng cho mỗi loại nhiên liệu. Bảng hỗ trợ nhiều loại nhưng chỉ seed
một dòng `e10_ron95_iii`; thêm loại khác về sau là thêm dữ liệu và một
dòng config, không phải sửa code.

### Config `config/fuel_prices.php`

```php
return [
    'cache_ttl_minutes' => 360,   // 6 giờ
    'stale_after_days' => 10,     // giá điều chỉnh mỗi thứ Năm
    'min_price' => 10000,
    'max_price' => 60000,
    'source_timeout_seconds' => 5,

    'types' => [
        'e10_ron95_iii' => [
            'label' => 'Xăng E10 RON 95-III',
            'pattern' => 'E10 RON 95-III',   // chuỗi các parser dùng để định vị
            'fallback_price' => 22660,       // giá seed ban đầu
        ],
    ],
];
```

## 5. Các nguồn cào

Mỗi nguồn là một class nhỏ, một trách nhiệm, test được độc lập bằng
fixture (HTML hoặc JSON) lưu sẵn.

```php
namespace App\Services\FuelPrice;

interface FuelPriceSource
{
    /** Tên hiển thị của nguồn, ví dụ "baohatinh.vn". */
    public function name(): string;

    /**
     * Đọc giá từ nội dung đã tải về (HTML hoặc JSON tùy nguồn).
     * Trả về null khi không tìm thấy hoặc giá nằm ngoài khoảng hợp lệ.
     *
     * @return array{price: int, date: ?string}|null
     */
    public function parse(string $html, string $pattern): ?array;

    /** URL để tải cho loại nhiên liệu này. */
    public function url(string $fuelKey): string;
}
```

Tách `parse()` khỏi việc tải mạng là chủ ý: test chạy trên fixture, không
bao giờ gọi mạng thật, nên không flaky. Việc gọi HTTP do `FuelPriceService`
làm — `Http::timeout(config('fuel_prices.source_timeout_seconds'))->get($source->url($fuelKey))`
— nên `Http::fake()` phủ được toàn bộ nhánh lỗi mạng trong test.

### `BaoHaTinhFuelSource`

URL: `https://baohatinh.vn/cong-cu/gia-xang-dau/ron95`

Giá nằm trong thẻ meta description, kèm một ngày. **Ngày đó là "hôm nay"
lúc tải trang, không phải ngày điều chỉnh giá** (trang tải 19/11/2026 ghi
"hôm nay 19/11/2026" dù giá đổi chiều 12/11), nên `FuelPriceService` ưu tiên
ngày của Petrolimex:

```html
<meta name="description" content="Giá Xăng E10 RON 95-III hôm nay 21/08/2026 ở mức 22.660 đồng/lít, tăng 550 đ so kỳ trước. ...">
```

Regex:

```
/Giá\s+Xăng\s+{pattern}\s+hôm nay\s+(\d{2}\/\d{2}\/\d{4})\s+ở mức\s+([\d.]+)\s+đồng\/lít/u
```

Nhóm 1 là ngày, nhóm 2 là giá (bỏ dấu chấm rồi ép sang int).

### `PetrolimexFuelSource` (từ 2026-11-19, thay `GiaVangNayFuelSource`)

URL: `https://portals.petrolimex.com.vn/~apis/portals/cms.item/search?x-request=…`

Đây là API mà chính petrolimex.com.vn gọi để hiện nút "Giá bán lẻ xăng dầu"
ở đầu trang (hàm `__vieapps.prices.fetch` trong
`portals.petrolimex.com.vn/_themes/sunrise/js/all.js`). Ba mã kho dữ liệu
`SystemID`, `RepositoryID`, `RepositoryEntityID` chép nguyên từ request đó;
Petrolimex đổi CMS thì phải dò lại trong file JS này.

`x-request` là JSON sau, mã base64url, bỏ dấu `=` ở cuối:

```json
{"FilterBy": {"And": [
   {"SystemID": {"Equals": "6783dc1271ff449e95b74a9520964169"}},
   {"RepositoryID": {"Equals": "a95451e23b474fe5886bfb7cf843f53c"}},
   {"RepositoryEntityID": {"Equals": "3801378fe1e045b1afa10de7c5776124"}},
   {"Status": {"Equals": "Published"}}]},
 "SortBy": {"LastModified": "Descending"},
 "Pagination": {"TotalRecords": -1, "TotalPages": 0, "PageSize": 0, "PageNumber": 0}}
```

Phản hồi, mỗi sản phẩm một phần tử:

```json
{"Objects": [
  {"Title": "Xăng E10 RON 95-III", "Zone1Price": 19840, "Zone2Price": 20230,
   "LastModified": "2026-11-12T07:50:29.63Z", "...": "..."}
]}
```

Thuật toán: tìm phần tử có `Title` bằng chính xác `Xăng {pattern}`, lấy
`Zone1Price` (giá Vùng 1, cùng mức baohatinh.vn). `date` là ngày của
`LastModified` đổi sang giờ Việt Nam; `LastModified` hỏng thì vẫn lấy giá,
`date => null`. Nội dung không phải JSON, thiếu `Objects`, không có dòng khớp,
hoặc giá ngoài khoảng → `null`.

Lưu ý bắt buộc: so khớp `Title` phải **bằng chính xác cả chuỗi**, không dùng
`str_contains`. Danh sách có cả `Xăng E10 RON 95-III` lẫn `Xăng E10 RON 95-V`;
khớp chính xác không tốn thêm gì và chặn sẵn trường hợp về sau xuất hiện tên
mà tên này là tiền tố của tên kia. Bắt nhầm dòng là hỏng ngầm.

> Lịch sử: `GiaVangNayFuelSource` (cào bảng HTML của giavangnay.com, không
> có ngày) dùng từ 2026-08-21 tới khi trang chết cuối 09/2026, xóa ngày
> 2026-11-19.

## 6. `FuelPriceService`

```php
namespace App\Services\FuelPrice;

class FuelPriceService
{
    /** Đọc giá hiện tại, tự làm mới nếu cache hết hạn. */
    public function current(string $fuelKey): FuelPrice;

    /** Buộc làm mới, bỏ qua cache. Trả về bản ghi sau khi xử lý. */
    public function refresh(string $fuelKey): FuelPrice;

    /** Admin đặt giá tay: ghi price + updated_by, xóa sources và last_error. */
    public function setManually(string $fuelKey, int $price, ?int $userId): FuelPrice;
}
```

Luồng của `refresh()`:

1. Tải song song 2 nguồn, mỗi nguồn timeout 5 giây. Ngoại lệ mạng được bắt
   và coi như nguồn đó trả null.
2. Gọi `parse()` từng nguồn. Loại bỏ kết quả ngoài khoảng
   `min_price`–`max_price`. Ngoại lệ mạng, mã lỗi HTTP, hay HTTP 200 mà
   `parse()` không ra giá đều ghi `Log::warning('Lấy giá xăng thất bại')`
   kèm `source`, `fuel_key`, `status`, `error` (trước 2026-11-19 chỉ log
   ngoại lệ, nên 56 ngày giavangnay.com trả 530 không để lại dòng log nào).
3. Cập nhật `last_checked_at` trong mọi trường hợp.
4. Nếu có **đúng 2** kết quả hợp lệ và **bằng nhau**: ghi `price`,
   `sources`, `source_date` (lấy từ nguồn **đầu tiên** có ngày; Petrolimex
   đứng đầu vì ngày của nó là ngày điều chỉnh giá), `fetched_at`, xóa
   `last_error`, xóa `updated_by`.
5. Ngược lại: giữ nguyên `price`, ghi `last_error` mô tả cụ thể. Ba thông
   điệp lỗi:
   - `"Hai nguồn lệch nhau: petrolimex.com.vn 22.500, baohatinh.vn 22.660"`
   - `"Chỉ lấy được 1/2 nguồn (petrolimex.com.vn lỗi)"`
   - `"Cả hai nguồn đều không lấy được"`

**Thứ tự ưu tiên giữa giá tay và giá tự động:** một lần cào thành công
(hai nguồn khớp) **ghi đè** giá admin nhập tay và xóa `updated_by`. Đây là
chủ ý: giá tay tồn tại để cứu lúc cào hỏng, mà lúc cào hỏng thì `refresh()`
không đụng vào giá nên giá tay vẫn nguyên. Khi cào chạy lại được, dữ liệu
tươi từ hai nguồn khớp nhau đáng tin hơn một con số nhập từ lâu.

`is_manual` là trường tính, không lưu: bằng `updated_by !== null`.

Cache: khóa `fuel_price:{fuelKey}`, TTL 6 giờ, lưu bản ghi đã xử lý.
`refresh()` xóa cache trước khi chạy.

Cờ `is_stale` được tính chứ không lưu: `fetched_at` rỗng, hoặc
`fetched_at` cách hiện tại quá `stale_after_days` ngày.

## 7. API

Đặt trong nhóm `Route::middleware('auth')` sẵn có, backend chỉ chặn `auth`
đúng theo pattern hiện hành của repo (xem mục 6 và 11 của spec gốc).

| Method | Đường dẫn | Action |
|---|---|---|
| GET | `/api/fuel-prices` | Danh sách mọi loại nhiên liệu đã cấu hình |
| POST | `/api/fuel-prices/{fuelKey}/refresh` | Buộc làm mới, bỏ qua cache |
| PUT | `/api/fuel-prices/{fuelKey}` | Admin đặt giá tay |

Hình dạng phản hồi mỗi phần tử:

```json
{
  "fuel_key": "e10_ron95_iii",
  "label": "Xăng E10 RON 95-III",
  "price": 22660,
  "sources": {"baohatinh.vn": 22660, "petrolimex.com.vn": 22660},
  "source_date": "2026-08-20",
  "fetched_at": "2026-08-21T04:00:00Z",
  "last_checked_at": "2026-08-21T04:00:00Z",
  "last_error": null,
  "is_manual": false,
  "is_stale": false
}
```

`PUT` validate `price` là `required|integer` trong khoảng
`min_price`–`max_price`.

## 8. Lệnh artisan

`php artisan fuel-price:refresh [fuelKey?]` — chạy `refresh()` cho một
hoặc mọi loại nhiên liệu, in kết quả ra stdout. Dùng để kiểm tra tay, và
sẵn sàng cho cron nếu về sau chuyển khỏi Render free tier.

## 9. Giao diện

Trong `CarRentalCalculator.jsx`:

0. Đổi giá mặc định cứng của phương án Xe xăng trong `DEFAULT_OPTIONS` từ
   `30000` xuống `22660` (`fallback_price` trong config), để khi API lỗi thì
   con số hiện ra vẫn gần đúng thay vì lệch 7.000 đ/lít.
1. Khi mount, gọi `GET /api/fuel-prices` **không chặn form**. Lỗi thì im
   lặng bỏ qua, giữ nguyên giá mặc định cứng.
2. Với form **mới** (không phải đang sửa bản ghi cũ), nếu lấy được giá thì
   dùng nó làm `fuel_unit_price` mặc định cho các phương án `fuel_type`
   là `petrol`.
3. Dưới ô "Đơn giá" của phương án chạy xăng, hiển thị dòng xuất xứ:

   ```
   Giá thị trường 22.660 đ/lít · baohatinh.vn + petrolimex.com.vn · 20/08/2026   [Dùng giá này]
   ```

   Nút "Dùng giá này" ghi giá vào ô. Người dùng gõ đè bất cứ lúc nào.
4. Khi `is_stale`, dòng trên chuyển màu hổ phách và thêm:
   *"Giá đã cũ N ngày, nên kiểm tra lại"*.
5. Khi `last_error` khác rỗng, hiển thị *"Lần cập nhật gần nhất thất bại:
   {last_error}"* dưới dạng chữ nhỏ màu hổ phách.
6. Khi `is_manual`, ghi *"Giá do quản trị viên nhập tay"* thay cho tên nguồn.

Không tự động ghi đè giá người dùng đã gõ, trong mọi trường hợp.

## 10. Test

Fixture lưu tại `BACKEND/tests/Fixtures/fuel-prices/`:
`baohatinh-2026-08-21.html` (trang thật ngày 21/08/2026) và
`petrolimex-2026-11-19.json` (phản hồi API thật ngày 19/11/2026). Không test
nào gọi mạng.

`tests/Unit/FuelPrice/BaoHaTinhFuelSourceTest.php`:
- Fixture thật ra đúng `['price' => 22660, 'date' => '2026-08-21']`
- HTML không có meta description khớp mẫu trả `null`
- Giá ngoài khoảng (ví dụ `999.999`) trả `null`

`tests/Unit/FuelPrice/PetrolimexFuelSourceTest.php`:
- URL mang đúng bộ lọc bảng giá bán lẻ (giải mã `x-request` để kiểm)
- Fixture thật ra đúng `['price' => 19840, 'date' => '2026-11-12']` (giá Vùng 1)
- **Không bắt nhầm dòng `E10 RON 95-V`** khi tìm `E10 RON 95-III`
- Không có dòng khớp, nội dung không phải JSON, thiếu `Objects`, thiếu giá,
  giá ngoài khoảng đều trả `null`
- `LastModified` đổi sang ngày giờ Việt Nam; `LastModified` hỏng thì vẫn lấy giá

`tests/Feature/FuelPriceServiceTest.php` (fake HTTP bằng `Http::fake()`):
- Hai nguồn khớp → cập nhật `price`, `sources`, `fetched_at`, xóa `last_error`;
  `source_date` là ngày của Petrolimex chứ không phải "hôm nay" của baohatinh.vn
- Nguồn trả mã lỗi HTTP, hoặc HTTP 200 mà không đọc được giá → ghi log kèm
  `source` và `status`; hai nguồn tốt thì không ghi log
- Hai nguồn lệch → **giữ giá cũ**, `last_error` nêu rõ cả hai số
- Một nguồn lỗi → giữ giá cũ, `last_error` nêu tên nguồn hỏng
- Cả hai lỗi → giữ giá cũ, `last_error` tương ứng
- Mọi nhánh đều cập nhật `last_checked_at`
- `setManually` ghi `updated_by`, xóa `sources` và `last_error`
- Sau `setManually`, một lần `refresh()` thành công **ghi đè** giá tay và xóa `updated_by`
- Sau `setManually`, một lần `refresh()` thất bại **giữ nguyên** giá tay và `updated_by`
- `is_stale` đúng ở ranh giới 10 ngày

`tests/Feature/FuelPriceControllerTest.php`:
- `GET` trả đúng hình dạng ở mục 7
- `POST .../refresh` gọi làm mới và trả bản ghi mới
- `PUT` đặt giá tay thành công; giá ngoài khoảng bị 422
- Chưa đăng nhập bị 401

## 11. Rủi ro đã biết

| Rủi ro | Cách xử lý |
|---|---|
| Một nguồn đổi layout | Quy tắc hai nguồn khớp chặn cập nhật sai; `last_error` hiện lên giao diện |
| Cả hai nguồn cùng chết | Giá đóng băng ở giá tốt cuối cùng, cờ `is_stale` làm việc đóng băng nhìn thấy được |
| Cả hai nguồn cùng sai giống nhau | Không phát hiện được. Chấp nhận: cả hai đều lấy từ công bố Petrolimex, và người dùng luôn sửa đè được |
| Nguồn đổi tên sản phẩm khi lộ trình E10 thay đổi | `pattern` nằm trong config, sửa một dòng; test fixture sẽ đỏ trước |
| Một nguồn chết hẳn (giavangnay.com, cuối 09/2026) | Giá đóng băng, `last_error` và log nêu tên nguồn + mã HTTP; thay nguồn khác như đã làm ngày 2026-11-19 |
| Petrolimex đổi CMS, API nội bộ đổi mã hoặc cấu trúc | Như trên; dò lại ba mã kho dữ liệu trong `_themes/sunrise/js/all.js` của trang chủ |
| Lần fetch đầu làm chậm màn hình | Gọi nền không chặn form; instance Render ngủ dậy sẵn từ request `/api/me` trước đó |
