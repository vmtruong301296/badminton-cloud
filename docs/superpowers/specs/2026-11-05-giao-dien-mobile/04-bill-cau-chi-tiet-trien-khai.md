# 04 Chi tiết bill cầu — triển khai (đợt 1, phương án A)

Ngày: 2026-11-05 · Nhánh `feature/mobile-04-chi-tiet` (tách từ `91fd4a4`) · Spec: `../2026-11-05-giao-dien-mobile-design.md`
(mục 2, 2.1) · Đề xuất: `04-bill-cau-chi-tiet-de-xuat.html`, phương án A · Chủ dự án duyệt hướng 05/11/2026.

Chỉ frontend. Không đổi API, route, cách tính tiền. Ảnh bill xuất trùng `main` từng byte (mục 5).

## 1. Đã làm

- **Thanh trên (M1)**: `‹ Bill #179 ⋯` (desktop vẫn "Chi tiết Bill #179"). Sheet ⋯: Sửa bill (có người đã TT thì hiện
  mờ + "Có người đã TT nên không sửa được"), Tạo bill con (chỉ bill chính), Xóa bill (→ `ConfirmDialog` cũ, có `busy`).
- **Dưới md (768 px)**: thẻ tóm tắt (`BillDetailSummary`: loại bill, ngày M6, trạng thái, "Đã thu x/y người" + thanh
  tiến độ, tổng tiền; "Thông tin Bill" gập: tiền sân / cầu / người, từng loại cầu, ghi chú; dải bấm sang bill con hoặc
  về bill chính) → chip lọc dính dưới thanh trên (Tất cả / Chưa TT / Đã TT / Nợ cũ, có số đếm) → danh sách hàng M3b
  (`BillPlayerList` + `BillPlayerRow`) → khối Tổng cộng / Tổng tiền đánh / Tiền lời / TT + Bill sau như cũ.
- **Hàng người chơi (M3b + M3c)**: STT (khớp cột TT ảnh xuất), tên, dòng phụ (mức tính hoặc giờ TT "21:13", chip Nợ cũ /
  n bill / Chi phí thêm), số phải thu (người nhiều bill: "TT + Bill sau"), nút "Đã TT" 84 × 44 có vòng quay khi đang lưu.
  Chạm phần trái mở chi tiết tại chỗ (mức tính, chi phí thêm, nợ cũ từng ngày, bill chính + bill sau), mỗi lúc một hàng.
  **Quyết định 8**: lưu xong hàng xuống nhóm đã trả như cũ (đang lọc "Chưa TT" thì rời danh sách).
- **Thanh dưới (M2)**: "Còn thiếu {n} người" + số tiền (rose) hoặc "Đã thu đủ {n} người" (emerald) + nút **Gửi ảnh**.
- **Hộp "Gửi ảnh bill"** (`SelectPaymentAccountDialog` chế độ mới): mở là dựng ảnh, chọn tài khoản (đổi thì dựng lại),
  xem trước, **Phóng to** (`BillImageZoom`, cỡ thật, kéo hai chiều, ✕ / Esc quay lại hộp), **Xuất Bill** / **Gửi Telegram**.
  Lỗi gửi hiện trong hộp ngay trên nút ("Gửi Telegram thất bại: …"), hộp không đóng; gửi xong hộp đóng + toast
  "Đã gửi bill qua Telegram thành công!". Desktop: Xuất Bill / Gửi Telegram ở đầu màn mở cùng hộp, nút vừa bấm là nút
  chính (bên phải).
- **Quyết định 11**: Xuất Bill trên máy cảm ứng (`(pointer: coarse)`) có `navigator.canShare({ files })` → bảng chia sẻ
  của máy với file PNG; hủy chia sẻ thì hộp ở lại; lỗi khác hoặc máy không hỗ trợ → tải file như cũ (cùng tên file).
- **Quyết định 12**: chỉ 1 tài khoản đang bật → hộp không có danh sách chọn (vẫn 2 chạm: Gửi ảnh → Gửi Telegram).
- **Quyết định 10** (tên quyền thật trong `RolePermissionSeeder.php`): Xóa cần `bills.delete`; Đã TT cần
  `bills.mark_payment` (thiếu thì hàng chỉ hiện nhãn "Đã TT" / "Chưa TT", desktop: ô tích tắt, `BillContent` nhận
  `onMarkPayment` rỗng); Sửa cần `bills.update`, Bill con / Tạo bill con cần `bills.create` (route đã chặn bằng quyền này).
  Tài khoản `limited` (chỉ `bills.view`): không có ⋯, không nút Đã TT, desktop chỉ còn Xuất Bill + Gửi Telegram.
- **Hộp nợ cũ** (`PayOldBillsDialog`): liệt kê từng bill cũ (ngày M6, bill con thụt vào), số thu trên nút
  ("Chỉ bill hiện tại" = tiền bill + bill con; "Cả bill cũ" = TT + Bill sau gồm nợ cũ), nút chính sát đáy, bỏ "Hủy" thừa;
  đang lưu: vòng quay trên nút đã chọn, hộp không đóng.
- **Bỏ đánh dấu**: `ConfirmDialog` cũ, `confirmLabel="Bỏ đánh dấu"` (vẫn rose), có `busy`.
- **alert() → M8 / M13**: lỗi đánh dấu → toast "Có lỗi xảy ra" + Thử lại; lỗi xóa → toast "Có lỗi xảy ra khi xóa bill";
  gửi / xuất → trong hộp; không tải được bill → khối "Không tìm thấy bill" (có Thử lại + Quay lại danh sách), hết tự quay về.
- **Desktop 1280**: bố cục giữ nguyên (bảng, `BillContent` 2 cột, thẻ bill chính). Đổi theo phương án A: hộp Gửi ảnh
  bill, hộp nợ cũ, nút "Bỏ đánh dấu"; ẩn nút theo quyền.
- Hàm thuần mới kèm test (viết test trước): `billTotals.js` (`playerSubBillLines`, `playerTotalWithSubBills`,
  `playerCurrentOnlyAmount`, `billCollection`, `billPerPersonAmount`), `billPlayers.js` (`sortBillPlayers`,
  `filterBillPlayers`, `countBillPlayers`, `oldBillIdsOf`), `billImageShare.js` (tài khoản mặc định / duy nhất, cách lưu
  ảnh, chi tiết lỗi API).

## 2. Chỗ chệch bản vẽ và lý do

| #   | Bản vẽ A                                                           | Triển khai                                                                                                                    | Lý do                                                                                                                        |
| --- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1   | Bấm Đã TT hàng đứng yên tới lần mở sau                             | Hàng xuống nhóm đã trả ngay khi lưu xong                                                                                      | Quyết định 8 (giữ như cũ)                                                                                                    |
| 2   | Hàng không có STT                                                  | Có STT (huy hiệu xám đầu tên, trong dòng chữ để không mất một cột)                                                            | Spec 2.1 — khớp cột TT ảnh xuất. STT tính theo cả danh sách, nên đổi khi có người vừa trả (ảnh xuất cũng đổi theo)           |
| 3   | Chip bật mỗi chip một màu (slate / rose / emerald / amber), số xám | Dùng `.chip` chung (bật: viền + nền emerald, dấu ✓); "Đã TT" mờ khi 0, "Nợ cũ" ẩn khi 0; chip về 0 thì lọc quay về Tất cả     | Brief: dùng mẫu M4 của nhóm 01, không tự chế                                                                                 |
| 4   | Khung "đang tải" theo bố cục mới, M2 khóa                          | Giữ khung xương cũ, chỉ ẩn khối tiêu đề dưới sm                                                                               | Thanh trên đã có ‹ dự phòng + nhãn tab (nhóm 01); dựng khung mới cần số liệu M2 khi chưa có bill — để lại nếu chủ dự án muốn |
| 5   | Nút Gửi ảnh rộng vừa chữ                                           | `flex-1` (chiếm phần còn lại của M2)                                                                                          | Theo cách dùng `ActionBar` của nhóm 01; vùng chạm lớn hơn                                                                    |
| 6   | "Sửa bill" mờ, dòng lý do xám đậm hơn                              | Cả nhãn và lý do cùng mờ 50 %                                                                                                 | `menu` của `AppBar` (nhóm 01) chưa có ô mô tả; truyền nhãn dạng node, nút `disabled` mờ cả hàng                              |
| 7   | Câu lỗi gửi nằm dưới ảnh xem trước                                 | Nằm ở chân hộp, ngay trên hai nút                                                                                             | Khi có 2+ tài khoản + ảnh cao, thân hộp cuộn và câu lỗi ở cuối thân bị khuất (đã thấy khi chụp 390)                          |
| 8   | Chưa vẽ trường hợp 1 tài khoản                                     | Ẩn hẳn danh sách chọn                                                                                                         | Quyết định 12; ảnh xem trước đã có QR của tài khoản đó                                                                       |
| 9   | Không nói hộp làm gì sau Xuất Bill                                 | Lưu / chia sẻ xong thì đóng; hủy bảng chia sẻ thì hộp ở lại                                                                   | Giống hành vi cũ (xuất xong không còn hộp); hủy chia sẻ nghĩa là chưa xong việc                                              |
| 10  | Khối "Không tìm thấy bill" chỉ có Quay lại danh sách               | Thêm "Thử lại"                                                                                                                | Lỗi mạng ở sân cũng rơi vào đây; chữ cũ của `EmptyState`                                                                     |
| 11  | Dưới sm / md lẫn lộn                                               | Thanh trên / M2 dưới sm (nhóm 01); nội dung mới (tóm tắt, chip, hàng) dưới **md**; 640–767 px: đầu màn desktop + nội dung mới | Bảng 7 cột chỉ có từ md như cũ; thẻ tóm tắt bỏ hàng badge từ sm để không lặp với đầu màn                                     |
| 12  | Thẻ người chơi cũ có chip "Nữ"                                     | Bỏ trên hàng mới (bản vẽ cũng không có)                                                                                       | Theo bản vẽ; mức tính vẫn hiện trên dòng phụ                                                                                 |
| 13  | Ô tích desktop                                                     | Tắt khi thiếu quyền hoặc đang lưu (không có vòng quay)                                                                        | Desktop giữ bố cục; chặn bấm đúp                                                                                             |

## 3. Chữ phát sinh ngoài danh sách đã gật

Đã dùng đúng danh sách gật: Đã thu · Còn thiếu {n} người · Đã thu đủ {n} người · Nợ cũ · Gửi ảnh · Gửi ảnh bill ·
Đang tạo ảnh… · Phóng to · Tạo bill con · Có người đã TT nên không sửa được · Bỏ đánh dấu · Lọc người chơi.

| Chữ                  | Ở đâu                                          | Ghi chú                                              |
| -------------------- | ---------------------------------------------- | ---------------------------------------------------- |
| "Ảnh bill xem trước" | `alt` ảnh xem trước, tên (aria) khung phóng to | Chỉ trình đọc màn hình                               |
| "Đã TT: {tên}"       | `aria-label` nút Đã TT trên hàng               | Như "Đã thanh toán: {tên}" của ô tích desktop cũ     |
| "{Nhãn chip} {số}"   | `aria-label` chip lọc ("Chưa TT 19")           | Ghép chữ cũ, để trình đọc có dấu cách giữa chữ và số |
| "{x}/{y} người"      | `aria-valuetext` thanh tiến độ                 | Cùng chữ hiện trên thẻ                               |

Chữ cũ dùng ở chỗ mới: "Chưa TT" (nhãn chỉ xem khi thiếu quyền), "Đang xuất…", "Đang gửi…", "Xuất Bill", "Gửi Telegram",
"Chọn tài khoản thanh toán" (nhãn trong hộp), "Có lỗi xảy ra khi xuất bill" + "Thử lại" (dựng ảnh lỗi), "Bill con"
(nhãn bill con không ghi chú trong danh sách nợ), "Bill #{id}" (tiêu đề thanh trên, như đầu `BillContent`), "Đóng".

## 4. Quyết định tự chọn

- "Điện thoại" ở quyết định 11 = con trỏ cảm ứng `(pointer: coarse)` (không theo bề ngang: điện thoại xoay ngang > 640 px
  vẫn chia sẻ được; máy tính dùng chuột vẫn tải file như cũ dù trình duyệt có Web Share).
- Ẩn Sửa (`bills.update`) và Bill con (`bills.create`) theo quyền, ngoài Xóa / Đã TT của quyết định 10: hai route này đã
  bị `ProtectedRoute` chặn, hiện nút chỉ dẫn tới màn "không có quyền".
- Ảnh dựng một lần mỗi tài khoản (lần dựng cũ bị bỏ nếu đổi tài khoản giữa chừng); cùng một file dùng để xem trước,
  lưu, chia sẻ và gửi Telegram (`nodeToBlob`, cùng tùy chọn với lần xuất cũ).
- Hai hộp dùng chung viết lại phần trong mà không đổi hành vi khi màn chưa truyền prop mới; hộp chọn tài khoản cũ bỏ
  `setState` trong effect (chọn mặc định tính từ danh sách) → hết 1 lỗi ESLint có sẵn.
- Bỏ "Hủy" ở hộp nợ cũ cho cả bill tiệc (bản vẽ ghi rõ "áp cho cả hai"; còn ✕, chạm nền, Esc — cùng gọi `onClose`).
- Không thụt lề lại khối desktop cũ khi bọc thêm `<div className="hidden md:block">` / `hidden sm:block` để diff chỉ còn
  chỗ đổi.

## 5. Kiểm chứng (05/11/2026, trong `FRONTEND` của worktree)

| Cổng                       | Kết quả                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                 | 10 file, **126 passed**, 0 failed (trước: 8 file / 94)                                                                                                                                                                                                                                                                                     |
| `npx eslint .`             | **2 lỗi + 8 cảnh báo** (mốc `91fd4a4`: 3 + 8) — bớt lỗi `set-state-in-effect` của `SelectPaymentAccountDialog`; cảnh báo `exhaustive-deps` có sẵn của `BillDetail` giữ nguyên                                                                                                                                                              |
| Build                      | `VITE_API_URL=/api npx vite build --config tools/vite.no-repo-write.config.mjs` ok (cảnh báo chunk > 500 kB có sẵn)                                                                                                                                                                                                                        |
| `git diff --stat 91fd4a4`  | 13 file, chỉ file của nhóm 04 (mục 6); file cũ sửa bằng script, không format lại cả file                                                                                                                                                                                                                                                   |
| Cổng 6 — ảnh xuất          | Bill cầu #179 (có bill con #180) và #176 ở 1280 + 390, bill tiệc #25 ở 1280 + 390, so với bản build `main` d438adb cùng máy chủ giả: **0 điểm ảnh khác, trùng từng byte** (`cmp`). Ở 390 file lấy qua bảng chia sẻ giả (`navigator.share` ghi lại file)                                                                                    |
| Desktop 1280 so với `main` | 6 bill chụp cả trang (#179, #180, #176, #173, #12, #178), chụp 2 lượt: #180, #12, #176 = 0 điểm khác; #173 / #178 / #179 = 9 / 7 / 8 điểm khử răng cưa ở mép biểu tượng / viền tròn, ổn định giữa các lượt, không thấy bằng mắt (ảnh phóng to 4–5×). #176 tự lệch 26.707 điểm giữa hai lượt chụp **chính bản `main`** (nhiễu kết xuất chữ) |

Ảnh (máy chủ giả cổng 4104 + `fixtures-04.mjs`; không chạm máy chủ thật), thư mục
`/private/tmp/claude-501/-Users-admin-Desktop-Github-APACTech-BadmintonNew/0c1bebe2-0704-4215-bcf9-7308f4798c3d/scratchpad/trien-khai/04-bill-cau-chi-tiet/anh/`:

- `viec-1/` — việc chính 1 ở 390: mở trang, lọc Chưa TT, đang lưu (vòng quay), hộp nợ cũ + đang lưu, đã TT 1 / 2 / 3
  người, lọc Đã TT, hộp Bỏ đánh dấu, mở chi tiết tại chỗ.
- `viec-2/` — việc chính 2 ở 390: đang tạo ảnh, xem trước, phóng to, lỗi gửi (câu của máy chủ thật), đang gửi, gửi xong + toast.
- `xuat/` — `main/`, `nhanh/`, `nhanh-tiec/` (file PNG xuất), `nhanh-shots/` (hộp Gửi ảnh bill 1280 + 390).
- `kho/` — 360 / 390 / 430 cả trang + 1280: #179 (25 người, bill con, 11 người nợ cũ, nợ 1,5 triệu), #180 (bill con),
  #178 (25 người chưa ai trả), #173 (38.250.000), #176 (80.337 đ/người → làm tròn), #12 (năm 2025), #99999 (không tìm
  thấy); `*-cuon-chip-dinh` (chip dính khi cuộn, 390 và 700), `*-700` (khoảng 640–767).
- `trang-thai/` — sheet ⋯, Thông tin Bill mở, chỉ 1 tài khoản, đang tải, thu đủ (lọc Chưa TT rỗng + M2 emerald).
- `quyen/` — profile `limited` 360 / 390 / 1280.
- `rong/` — dataset rỗng (bill không có → khối Không tìm thấy bill).
- `so-main/` — desktop hai bản.

Đã kiểm thêm: Esc trong khung phóng to chỉ đóng khung (hộp còn), Tab quay vòng ✕ ↔ vùng ảnh, đóng xong focus về "Phóng to".
Chưa kiểm được (cần máy thật): bảng chia sẻ thật của iOS / Android (Web Share cần HTTPS + thao tác vừa chạm; ảnh dựng sẵn
khi mở hộp nên lần chạm "Xuất Bill" gọi `share` ngay), chụm 2 ngón trong khung phóng to.

## 6. API cho nhóm khác (05 bill tiệc dùng lại)

### `PayOldBillsDialog` (`components/common`)

Cũ: `isOpen, onClose, onPayCurrentOnly, onPayAll, playerName, debtAmount`. Mới, đều tùy chọn:

| Prop                         | Ý nghĩa                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `debtDetails`                | `debt_details` của API: `[{ date, parent_amount (có thể null), sub_bills: [{ note, amount }] }]`        |
| `currentAmount`, `allAmount` | số thu của 2 lựa chọn (truyền cả hai thì in trên nút)                                                   |
| `busy`                       | `"current"` / `"all"` → vòng quay trên nút đó; `true` → chỉ khóa. Đang busy: 2 nút khóa, hộp không đóng |

Không còn nút "Hủy" (✕ / nền / Esc gọi `onClose`).

### `SelectPaymentAccountDialog` (`components/common`)

- Như cũ khi không truyền `buildImage`; thêm `confirmLabel` (mặc định "Xác nhận").
- Chế độ "Gửi ảnh bill" khi truyền `buildImage`:

| Prop                              | Ý nghĩa                                                                                                |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `buildImage(accountId)`           | `=> Promise<Blob>` PNG với tài khoản đó (màn tự set tài khoản cho khối xuất, đợi vẽ, `nodeToBlob`)     |
| `fileName`                        | tên file khi lưu / chia sẻ (bill tiệc: `Bill_Tiec_{id}_{dd-mm-yyyy}.png` như cũ)                       |
| `onSendTelegram(blob, accountId)` | gửi; ném lỗi → hộp hiện "Gửi Telegram thất bại: {chi tiết}"; xong → hộp tự `onClose`, màn tự báo toast |
| `primaryAction`                   | `"telegram"` (mặc định) \| `"download"` — nút chính bên phải                                           |
| `title`                           | mặc định "Gửi ảnh bill"                                                                                |

Màn dùng hộp kiểu cũ mà muốn bỏ qua bước chọn khi chỉ 1 tài khoản: `onlyActivePaymentAccountId(accounts)`
(`utils/billImageShare.js`) trả id thì gọi thẳng hàm xuất / gửi.

### `BillPlayerRow` + `BillPlayerTag` (`components/bill/BillPlayerRow.jsx`)

Render một `<li>`, đặt trong `<ul className="list-card">`.

| Prop                                                | Ý nghĩa                                                                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `index`                                             | STT (tùy chọn)                                                                                                       |
| `name`                                              | tên (nhãn nút thành "Đã TT: {name}")                                                                                 |
| `meta`                                              | mảng node dòng phụ (mục falsy bị bỏ; mục cuối đi cùng mũi tên); chip nhỏ: `<BillPlayerTag tone="amber\|sky\|slate">` |
| `amount`, `amountNote`                              | chuỗi đã in qua `formatters.js`; dòng nhỏ sky dưới số tiền                                                           |
| `paid`, `saving`, `onTogglePaid`                    | trạng thái nút; không truyền `onTogglePaid` → nhãn chỉ xem "Đã TT" / "Chưa TT"                                       |
| `highlight`                                         | nền sky + vạch trái (rose chưa trả / emerald đã trả)                                                                 |
| `expanded`, `onToggleExpand`, `panelId`, `children` | chi tiết mở tại chỗ (màn giữ mỗi lúc một hàng mở)                                                                    |

Cũng dùng được: `BillImageZoom` (`{ url, alt, onClose }`), `utils/billImageShare.js`.

Lưu ý cho 05: seeder chỉ có `party_bills.view/create/update/delete`, **không có** quyền đánh dấu thanh toán riêng cho
bill tiệc — cần chọn (vd `party_bills.update`) khi làm quyết định 10 phía bill tiệc.

## 7. Thấy khi làm, ngoài phạm vi (không sửa)

- `screens/bills/BillDetail.jsx:156` — đánh dấu đã TT ở bill chính tự đánh dấu cả bill con, bỏ đánh dấu thì không bỏ ở
  bill con (đọc code; có sẵn).
- `screens/bills/BillDetail.jsx:193` — "Cả bill cũ" gọi `getById` từng bill cũ rồi mới đánh dấu (2 request mỗi bill cũ).
  Giả thuyết — chưa đo: chậm trên 4G khi nợ nhiều bill.
- `components/bill/BillContent.jsx:19`, `:56` — thứ tự người chơi và tiền bill con trùng logic với `utils/billPlayers.js`,
  `utils/billTotals.js` mới; có thể cho `BillContent` dùng chung (chưa làm để không đụng giao diện desktop).
- Đề xuất cho nhóm 01: `index.css` `.list-row[aria-expanded="true"] .list-row-chevron` không áp cho M3b + M3c (vùng bấm là
  `.list-row-main`), nhóm 04 tự xoay mũi tên; `menu` của `AppBar` chưa có ô mô tả cho mục bị khóa; `ActionBar` `summary`
  chưa có tông màu (đang truyền node có class màu).
- Mỗi lần dựng ảnh, html-to-image in lỗi console "Error inlining remote css file … SecurityError" khi đọc stylesheet Google
  Fonts — có sẵn ở `main` (đã thấy cùng lỗi khi xuất trên bản `main`), ảnh vẫn đúng.
