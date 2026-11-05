# Sửa bill cầu giữ "Đã TT" — bàn giao (2026-11-05)

Nhánh `fix/sua-bill-giu-da-tt` (tách từ `main` 6557874). Commit sửa lỗi: `0ed76b7`.
Chưa deploy, chưa merge, chưa push.

## Triệu chứng

Sửa một bill cầu (`PUT /api/bills/{id}`) xong thì mọi người đã TT trong bill về **Chưa TT**,
mất luôn giờ TT (`paid_at`). Hệ quả kéo theo: bill cũ vừa sửa hiện lại thành **nợ cũ** ở các bill
sau của những người đó (màn chi tiết bill tính nợ cũ từ `is_paid = false` của các bill trước).

## Nguyên nhân (có bằng chứng)

`BillController::update` (bản `main` 6557874) xóa hết `bill_players` của bill
(`$bill->billPlayers()->delete()`, dòng 440) rồi tạo lại từng người bằng
`BillPlayer::create([... 'is_paid' => false])` (dòng 475–487), không có `paid_at`.

Bằng chứng:

1. Test tái hiện `BACKEND/tests/Feature/BillUpdatePaidStatusTest.php` chạy trên code chưa sửa,
   3 lần liên tiếp cùng kết quả `8 failed, 1 passed (54 assertions)`. Lỗi đặc trưng:
   ```
   FAILED  BillUpdatePaidStatusTest > sua bill giu da tt cua nguoi da thanh toan
   An phải còn Đã TT — Failed asserting that false is true.
   FAILED  BillUpdatePaidStatusTest > sua bill cu da tt khong hien lai thanh no cu o bill sau
   Bill cũ An đã TT không được thành nợ cũ sau khi sửa — Failed asserting that 100000 is identical to 0.
   ```
   Ca pass sẵn là "bỏ đánh dấu TT rồi sửa bill vẫn là chưa TT" (ca canh để không giữ quá tay).
2. Probe tạm (test để ở scratchpad của phiên, ngoài repo, không commit): 1 bill, 1 người, đánh dấu
   TT rồi PUT lại đúng payload cũ:
   ```
   before PUT: id=1 is_paid=true paid_at=2026-11-05 07:29:43
   after PUT:  id=2 is_paid=false paid_at=NULL
   row with old id exists: false
   ```
   → `markPayment` có ghi thật; dòng bị **xóa rồi tạo lại**, không phải bị đặt lại tại chỗ
   (`BillPlayer` không có observer/event nào).
3. Sau khi sửa: cùng bộ test `9 passed (73 assertions)`.

## Cách sửa

`BACKEND/app/Http/Controllers/Api/BillController.php`:

- Trước khi xóa, đọc trạng thái thanh toán hiện có theo `user_id`
  (hàm riêng `paymentStatusByUser(Bill $bill)`: `user_id → {is_paid, paid_at}`).
- Khi tạo lại người chơi: người còn trong bill lấy lại `is_paid` / `paid_at` cũ; người mới
  `is_paid = false`, `paid_at = null`; người bị bỏ khỏi bill vẫn bị xóa như cũ.
- Cách tính tiền **không đổi** (đơn giá, suất, nước, cộng thêm, nợ từ bảng `debts`).

Vì sao **không** chuyển sang cập nhật tại chỗ (giữ id `bill_players`):

- Không bảng nào cần id cũ: chỉ `bill_player_menus.bill_player_id` tham chiếu (cascade, và vẫn
  được xóa - tạo lại trong cùng transaction). Frontend chỉ dùng id này làm React `key`
  (`BillDetail.jsx:944`, `BillContent.jsx:239`); đánh dấu TT đi theo `user_id`
  (`POST /bills/{id}/players/{user_id}/pay`).
- Cập nhật tại chỗ đổi thêm hành vi: thứ tự người chơi trả về sẽ theo id cũ thay vì theo thứ tự
  gửi lên, `created_at` của dòng giữ cũ, phải viết thêm nhánh so khớp cho menu. Giữ xóa - tạo lại
  và chỉ mang trạng thái thanh toán sang là thay đổi nhỏ nhất.

Trạng thái thanh toán đọc ở máy chủ lúc lưu, không lấy từ form: `UpdateBillRequest` không nhận
`is_paid`. Nếu có người được đánh dấu TT trong lúc màn Sửa bill đang mở thì bấm lưu vẫn giữ dấu đó.

## Hệ quả đã kiểm (test trong `BillUpdatePaidStatusTest`)

| Tình huống                                                              | Kết quả sau sửa                                                                                                             |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Người đã TT, PUT lại y nguyên                                           | Vẫn Đã TT, `paid_at` giữ đúng giờ TT ban đầu (test đổi giờ hệ thống trước khi PUT)                                          |
| Thêm người mới                                                          | Người mới Chưa TT, `paid_at` null; người cũ giữ Đã TT                                                                       |
| Bỏ một người (kể cả người đã TT)                                        | Dòng của người đó bị xóa; người còn lại giữ Đã TT                                                                           |
| Đổi mức tính, tiền sân, thêm nước cho người đã TT                       | Tiền tính lại như cũ (vd 300.000 / 1,5 suất → An 100.000 + nước 30.000); **vẫn giữ Đã TT** (mặc định an toàn, chờ quyết)    |
| Đã bỏ đánh dấu TT rồi sửa bill                                          | Vẫn Chưa TT, `paid_at` null                                                                                                 |
| Nợ trong bảng `debts`                                                   | `debt_amount` vẫn tính như cũ (50.000 → tổng 150.000); sửa bill **không** đụng bảng `debts` (`is_resolved` giữ nguyên)      |
| Nợ cũ từ bill trước (`debt_amount`, `debt_details` ở `GET /bills/{id}`) | Sửa bill cũ mà An đã TT → bill sau của An **không** còn hiện bill đó là nợ cũ; Bình chưa TT thì nợ cũ vẫn 100.000 như trước |
| Sửa bill con                                                            | Giữ Đã TT; `parent_bill_id` giữ nguyên                                                                                      |
| Sửa bill chính                                                          | Giữ Đã TT của bill chính; người chơi của bill con **không bị đụng** (giữ nguyên id dòng, giữ Đã TT)                         |

Đã kiểm thêm bằng đọc code:

- `markPayment` ở máy chủ chỉ đổi `is_paid` / `paid_at` của một dòng, không tạo hay giải nợ trong
  bảng `debts`. Chuyện "TT cả bill cũ" và "TT bill chính kéo theo bill con" là luồng của frontend
  (`BillDetail.jsx` 156–213), gọi lần lượt `markPayment` cho từng bill nên không bị bản sửa này ảnh hưởng.
- `debt_amount` / `debt_details` trả về ở `show` được tính lúc đọc (không lưu), dựa trên `is_paid`
  của các bill trước. Vì thế giữ đúng `is_paid` thì nợ cũ của các bill sau cũng đúng.
- Id `bill_players` vẫn đổi sau mỗi lần sửa (như trước); không chỗ nào phụ thuộc (xem trên).

## Giao diện

- `FRONTEND/src/screens/bills/EditBill.jsx`: dải lưu ý ở màn Sửa bill (chỉ hiện khi có người đã TT)
  đổi chữ.
  - Cũ: "**{n} người đã TT trong bill này.** Lưu thay đổi sẽ đưa họ về Chưa TT."
  - Mới: "**{n} người đã TT trong bill này.** Lưu thay đổi vẫn giữ Đã TT cho người còn trong bill,
    kể cả khi số tiền thay đổi."
  - Giữ dải (màu vàng) vì đây vẫn là điều người sửa cần biết: tiền của người đã TT có thể đổi mà dấu
    không đổi. Nếu chủ dự án quyết bỏ dấu khi tiền đổi thì chữ này phải đổi theo.
- Khóa "Sửa bill" ở màn chi tiết (`BillDetail.jsx` 550, 566–574, 665–674) **giữ nguyên**. Khóa chỉ có
  ở giao diện: route `/bills/:id/edit` (`App.jsx:184`) chỉ kiểm quyền `bills.update`, `EditBill`
  không tự chặn, `BillController::update` không chặn. Vào được màn sửa khi có người đã TT bằng cách
  gõ thẳng đường dẫn, hoặc khi có người được đánh dấu TT lúc màn sửa đang mở.
- Tài liệu thiết kế cũ `docs/superpowers/specs/2026-11-05-giao-dien-mobile/03-bill-cau-tao-sua-*`
  còn ghi chữ cũ; đó là bản ghi lịch sử của đợt giao diện nên để nguyên.

## Kiểm chứng

- Backend `php artisan test` (SQLite `:memory:`): trước sửa **132 passed (409 assertions)**; sau sửa
  **141 passed (482 assertions)**, 0 failed (9 test mới). `vendor/bin/pint --test` trên 2 file đụng: PASS.
- Frontend (`FRONTEND`): `npm test` 19 file / 235 test pass (trước và sau như nhau);
  `npx eslint .` 2 lỗi + 6 cảnh báo, bằng mốc `main`, không lỗi nào ở `EditBill.jsx`;
  `VITE_API_URL=/api npx vite build` (ra thư mục scratchpad) build OK.
- Chưa chụp ảnh màn Sửa bill: chỉ đổi chữ trong dải sẵn có, dải chỉ hiện khi có người đã TT (cần
  dựng API giả). Nên xem bằng mắt một lần khi duyệt.

## Cần chủ dự án quyết

1. **Người đã TT mà tiền thay đổi khi sửa bill** (đổi mức tính, tiền sân, cầu, nước, cộng thêm, hoặc
   nợ trong bảng `debts` đã đổi kể từ lúc tạo bill): hiện **giữ Đã TT** và chỉ có dải lưu ý ở màn sửa.
   Có cần (a) bỏ dấu Đã TT khi tiền tăng, (b) báo ở màn chi tiết / danh sách, hay (c) giữ như hiện
   nay? Lưu ý: hệ thống **không lưu số tiền đã trả** (`markPayment` bỏ qua `amount` khi có `is_paid`),
   nên hiện không biết được người đó trả thiếu bao nhiêu.
2. **Mở khóa "Sửa bill" ở màn chi tiết khi đã có người TT?** Lý do khóa ("sửa sẽ mất Đã TT") không còn
   đúng sau bản sửa này. Mặc định: **không đổi khóa**. Nếu mở thì cần quyết luôn câu 1.
3. (Nhỏ) Bỏ một người đã TT khỏi bill rồi thêm lại ở lần sửa sau thì người đó là người mới, Chưa TT.
   Giữ như vậy?

## Cách khôi phục

`git revert 0ed76b7` là quay về hành vi cũ (sửa bill đưa mọi người về Chưa TT). Bản sửa không có
migration, không đổi dữ liệu có sẵn, không đổi API (chỉ thêm `paid_at` được giữ), nên revert an toàn.
Commit tài liệu này có thể giữ hoặc revert tùy ý.

## Lưu ý dữ liệu production

Những bill đã bị mất "Đã TT" vì lỗi này trước đây **không tự khôi phục**: dòng `bill_players` cũ đã bị
xóa cùng `is_paid` / `paid_at`, trong DB không còn dấu vết để dựng lại. Bản sửa chỉ ngăn lỗi từ nay về
sau. Không viết script sửa dữ liệu; nếu cần thì người thu tiền đánh dấu lại bằng tay.

## Ngoài phạm vi (không sửa)

- `FRONTEND/src/screens/bills/BillDetail.jsx:156–182`: đánh dấu TT ở bill chính thì tự đánh dấu bill
  con, nhưng bỏ đánh dấu thì bill con không bỏ theo.
- `FRONTEND/src/screens/bills/BillDetail.jsx:185–213`: "Cả bill cũ" gọi `GET /bills/{id}` rồi
  `POST .../pay` cho từng bill cũ (2 request/bill), lỗi từng bill chỉ `console.error`.
- `FRONTEND/src/App.jsx:184` + `EditBill.jsx` + `BillController::update`: khóa "Sửa bill khi có
  người đã TT" chỉ ở giao diện (xem phần Giao diện).
- `BACKEND/app/Http/Requests/UpdateBillRequest.php:34`, `StoreBillRequest.php:34`: `players.*.user_id`
  không có `distinct`, một người có thể bị gửi hai lần; `markPayment`
  (`BillController.php:539`, `firstOrFail`) khi đó chỉ đánh dấu một dòng.
- `BACKEND/app/Http/Controllers/Api/BillController.php:352–524`: `update` dài ~170 dòng và lặp gần hết
  logic tính tiền của `store`; nên tách khi có task riêng.
