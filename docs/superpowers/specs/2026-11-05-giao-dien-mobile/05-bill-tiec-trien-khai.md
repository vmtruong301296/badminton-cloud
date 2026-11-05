# 05 Bill tiệc — triển khai (đợt 2, phương án A, không làm A+)

Ngày: 2026-11-05 · Nhánh `feature/mobile-05-bill-tiec` (tách từ `eea5cd1`, đã merge `feature/giao-dien-mobile` ở `ffc0464`)
· Spec: `../2026-11-05-giao-dien-mobile-design.md` (mục 2, 2.1) · Đề xuất: `05-bill-tiec-de-xuat.html`, phương án A ·
Chủ dự án duyệt hướng 05/11/2026.

Chỉ frontend. Không đổi route, API, payload, cách tính tiền. Ảnh bill xuất trùng `main` từng byte (mục 6).

## 1. Đã làm

- **Danh sách** (`PartyBills.jsx`): tiêu đề "Bill tiệc" (QĐ 4, cả desktop). Dưới md: ô "Chưa thanh toán" (M11, ẩn khi
  không ai nợ) mở sheet; "Lọc" ghim trái (sheet: Từ ngày / Đến ngày / Tên tiệc, chân "Xóa lọc" + "Xem {n} bill") + chip
  khoảng ngày có ✕ + 3 chip trạng thái (mặc định 1 phần + Chưa TT như cũ); hàng M3 bấm cả hàng (tên, "T7, 24/10 · n người
  chưa TT", Tổng tiệc, badge; quá hạn `.list-row-warn` + badge "Quá hạn"); "Xem thêm" 10 bill / lần (QĐ 14). FAB `.fab`.
  Rỗng: "Chưa có bill tiệc nào" (chưa có bill) / "Không có bill nào khớp bộ lọc" + "Xóa lọc" (đang lọc) — cả desktop.
  Lỗi tải: `EmptyState tone="error"` + "Thử lại" (thay `alert`).
- **"Đã trả hết"** (QĐ 7): sheet "Chưa thanh toán" (dưới lg) mỗi người tên, tổng nợ, ngày thiếu (M6), nút M3b "Đã trả hết";
  desktop giữ ô tích ở cột phải. Cả hai qua `ConfirmDialog` ("Xác nhận thanh toán", "Đánh dấu {tên} đã thanh toán {n} bill
  tiệc ({tổng})?", nút "Đã thanh toán", `busy`) rồi thông báo ngắn.
- **Chi tiết** (`PartyBillDetail.jsx`, giống chi tiết bill cầu): thanh trên `‹ {tên bill} ⋯` (tab ẩn), ⋯ = Sửa bill (có
  quyền và chưa trả hết, như cũ) / Xóa bill. Dưới md: thẻ tóm tắt (`PartyBillSummary`: trạng thái, ngày M6, "Bill tiệc #id",
  "Đã thu x/y người" + thanh tiến độ, Tổng tiệc; "Thông tin Bill" gập: tiền tiệc, từng khoản thêm — khoản Thuê xe có biểu
  tượng xe + "xem chuyến xe", tiền thêm, đơn giá, ghi chú) → chip Tất cả / Chưa TT / Đã TT / Nợ cũ (dính dưới thanh trên)
  → hàng M3b `BillPlayerRow` của 04 (STT như cũ, dòng phụ mức tính hoặc giờ TT + chip Nợ cũ / Đã chi / Tiền thêm, số tiền,
  nút "Đã TT" có vòng quay) mở chi tiết tại chỗ (mức tính, chia bill, đã chi, tiền thêm, thành tiền, ghi chú; nợ cũ từng
  bill "ngày · tên bill" + Tổng tiền) → "Tổng người tham gia" như cũ. `ActionBar`: "Còn thu · n người" (rose) / "Đã thu đủ"
  (emerald) + "Gửi ảnh".
- **Nợ cũ trên màn** (QĐ 9): số trên hàng = cột "Tổng tiền" của ảnh xuất (thành tiền + nợ bill tiệc cũ); desktop thêm cột
  "Nợ cũ" (số + từng ngày). Hộp nợ cũ dùng `PayOldBillsDialog` mới của 04 (liệt kê bill cũ, số tiền trên hai nút, `busy`).
- **Gửi / xuất ảnh**: `SelectPaymentAccountDialog` chế độ "Gửi ảnh bill" (xem trước, Phóng to, Xuất Bill / Gửi Telegram,
  Web Share trên máy cảm ứng, bỏ danh sách khi 1 tài khoản). Desktop: Xuất Bill / Gửi Telegram ở đầu màn mở cùng hộp.
  Gửi xong: thông báo "Đã gửi bill tiệc qua Telegram thành công!"; lỗi hiện trong hộp.
- **Tạo / Sửa** (`CreatePartyBill.jsx` 778 → 199 dòng, `EditPartyBill.jsx` 882 → 303; phần chung tách ra `components/party/`):
  dưới sm Tên đứng đầu rồi Ngày + Tổng tiền tiệc; Enter nhảy Tên → Tổng tiền tiệc → từng khoản thêm, Enter ở ô tiền khoản
  cuối thì thêm dòng và đưa con trỏ vào ô tên mới. Khoản thêm một dòng (tên · tiền canh phải · xóa), tổng ở đầu thẻ, "Thêm"
  ở cuối. "Chọn người" mở `PlayerPickerSheet` của 03 (`showRatio={false}` → bỏ "Mức: x"; tiêu đề "Chọn người", chân "Xong",
  thêm nhanh mang sẵn chữ vừa gõ, mở chồng lên sheet). Mỗi người một hàng "chỉ ghi ngoại lệ"; chạm hàng mở sheet sửa một
  người (4 ô cũ, Chia bill / Thành tiền xem trước, "Xóa khỏi bill" — không có với người đã TT). `ActionBar` "Tổng cộng · N
  người" + Tạo / Cập nhật; Hủy = ‹. Màn sửa: dòng Thuê xe chỉ đọc, người đã TT có nhãn "Đã TT".
- **Ẩn nút theo quyền** (QĐ 10, tên quyền thật trong `RolePermissionSeeder.php`): Xóa cần `party_bills.delete`; Sửa cần
  `party_bills.update`; Đã TT và "Đã trả hết" cần `party_bills.update` (seeder không có quyền đánh dấu riêng cho bill tiệc —
  **chọn update**); FAB / "Tạo Bill tiệc" / "Tạo bill đầu tiên" cần `party_bills.create`. Profile `limited` (chỉ
  `party_bills.view`): không FAB, không ⋯, hàng chỉ hiện nhãn "Đã TT" / "Chưa TT", không nút "Đã trả hết", vẫn Gửi ảnh
  (API chỉ cần đăng nhập, như cũ).
- **`alert()` → M8 / M13 / M14**: hết `alert` / `confirm` trong `screens/party/*`. Kiểm form: "Vui lòng nhập tên/nội dung
  tiệc" dưới ô Tên, "Vui lòng nhập ít nhất 1 người" dưới "Chọn người" (cuộn + focus ô sai đầu tiên). Lỗi lưu / đánh dấu /
  xóa: thông báo ngắn (lưu và đánh dấu có "Thử lại"). Lỗi tải chi tiết / màn sửa: khối lỗi + "Thử lại" + "Quay lại danh
  sách" (không tự quay về). Thêm nhanh: lỗi tại ô / khối rose trong hộp. "Không thể sửa bill tiệc đã thanh toán": thông báo
  ngắn rồi về chi tiết như cũ. Hộp bỏ đánh dấu: nút "Bỏ đánh dấu".
- Hàm thuần mới kèm test (viết test trước): `utils/partyBillList.js` (trạng thái, quá hạn, lọc, số điều kiện lọc, gộp người
  chưa thanh toán + số bill), `utils/partyBillTotals.js` (thành tiền, tổng tiền gồm nợ cũ, Tổng tiệc, thứ tự STT, tiến độ
  thu, bill cũ còn nợ, dòng nợ cho hộp dùng chung, xem trước form, ngoại lệ, payload, lỗi form).

## 2. Chỗ chệch bản vẽ và lý do

| #   | Bản vẽ A                                                       | Triển khai                                                                                          | Lý do                                                                                                                                   |
| --- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A16: bấm TT hàng đứng yên tới lần mở sau                       | Hàng xuống nhóm đã trả khi lưu xong                                                                 | QĐ 8                                                                                                                                    |
| 2   | A14: hai nhóm "Chưa / Đã thanh toán" có đầu nhóm               | Chip Tất cả / Chưa TT / Đã TT / Nợ cũ + một danh sách (chưa TT trước)                               | PM: chi tiết bill tiệc phải giống bill cầu (04)                                                                                         |
| 3   | A17: chạm hàng mở sheet một người (có nút Đánh dấu TT)         | Mở chi tiết tại chỗ (M3c) như bill cầu; đánh dấu bằng nút trên hàng                                 | Như trên                                                                                                                                |
| 4   | Nút tròn 44 px                                                 | Nút có chữ "Đã TT" 84 × 44 (`BillPlayerRow`)                                                        | M3b PM chốt (tổng hợp 3.2)                                                                                                              |
| 5   | M2: biểu tượng Xuất Bill + "Gửi Telegram"                      | Một nút "Gửi ảnh" → hộp có Xuất Bill / Gửi Telegram                                                 | PM: ActionBar giống bill cầu                                                                                                            |
| 6   | Tóm tắt: Tổng tiệc lớn, "Đã thanh toán x/y người" dưới thanh   | "Đã thu x/y người" trái, Tổng tiệc phải (bố cục thẻ của 04)                                         | Giống bill cầu; chữ "Đã thanh toán {x}/{y} người" không dùng                                                                            |
| 7   | Số trên hàng = thành tiền, dòng phụ "Nợ cũ 540.000 ₫ (2 bill)" | Số trên hàng = Tổng tiền gồm nợ cũ (như ảnh xuất và bill cầu), chip "Nợ cũ", chi tiết trong phần mở | Số trên màn bằng số trong ảnh gửi nhóm (mục đích QĐ 9); giống bill cầu. "Còn thu" vì thế cũng gồm nợ cũ (bill cầu "Còn thiếu" cũng gồm) |
| 8   | A1: bill quá hạn nền rose, "Quá hạn" trong dòng phụ            | Vạch rose mép trái (`.list-row-warn`) + badge "Quá hạn"                                             | Kiểu hàng bill M3 của 02 (chủ dự án duyệt "không tô cả hàng")                                                                           |
| 9   | A2: sheet Lọc có "Số bill / trang"                             | Bỏ; danh sách điện thoại "Xem thêm"                                                                 | QĐ 14                                                                                                                                   |
| 10  | A3: nút tròn trả hết                                           | Nút có chữ "Đã trả hết" (M3b, chữ của 02); ngày thiếu thành nhãn nhỏ                                | M3b; cùng chữ với bill cầu                                                                                                              |
| 11  | A12: chưa chọn ai → toast                                      | Lỗi ngay dưới "Chọn người" (M14) + cuộn tới; thiếu tên cũng báo dưới ô                              | Quy tắc đợt 0: không dùng thông báo ngắn cho kiểm form                                                                                  |
| 12  | Đếm 24 chạm (Enter × 4)                                        | 25 chạm (Enter × 5)                                                                                 | Ô tên khoản 1 (điền sẵn "Bánh + Tôm") vẫn là một điểm dừng của Enter                                                                    |
| 13  | Nút xóa khoản thêm × xám                                       | Thùng rác `btn-danger-soft` như desktop                                                             | Một nút cho cả hai cỡ, không thêm kiểu mới                                                                                              |
| 14  | Hàng người ở form 56 px                                        | 64 px (`.list-row`)                                                                                 | Class chung M3                                                                                                                          |
| 15  | A25: khung xương khi tải chi tiết                              | Giữ thẻ "Đang tải bill tiệc…" (cả màn sửa)                                                          | Thanh trên đã có ‹ dự phòng + nhãn tab; như 04 giữ khung chờ cũ                                                                         |
| 16  | Desktop chi tiết giữ nguyên                                    | Thêm cột "Nợ cũ"; Xuất Bill / Gửi Telegram mở hộp "Gửi ảnh bill"                                    | QĐ 9 không giới hạn điện thoại; hộp dùng chung như bill cầu                                                                             |
| 17  | Sheet chọn người có cả người đã TT (màn sửa)                   | Người đã TT không nằm trong sheet chọn                                                              | Người đã TT không bỏ khỏi bill được (như desktop); tránh chạm mà không có tác dụng                                                      |

## 3. Chữ phát sinh ngoài danh sách đã gật của 05

Không có chữ mới hoàn toàn. Chữ đã gật ở nhóm khác, nay dùng cho bill tiệc để giống bill cầu:

| Chữ                                                                                                   | Ở đâu                                                     | Gốc                  |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | -------------------- |
| "Đã thu" + "{x}/{y} người" (+ `aria-valuetext`)                                                       | Thẻ tóm tắt chi tiết (thay "Đã thanh toán {x}/{y} người") | 04                   |
| Chip "Tất cả" / "Chưa TT" / "Đã TT" / "Nợ cũ" + số; nhóm "Lọc người chơi"; `aria-label` "{chip} {số}" | Chi tiết điện thoại                                       | 04                   |
| "Đã thu đủ {n} người"                                                                                 | Lọc Chưa TT mà không còn ai                               | 04                   |
| "Gửi ảnh", "Gửi ảnh bill", "Phóng to", "Ảnh bill xem trước"                                           | ActionBar + hộp dùng chung                                | 04                   |
| `aria-label` "Đã TT: {tên}"                                                                           | Nút trên hàng                                             | 04 (`BillPlayerRow`) |
| "Đã trả hết", `aria-label` "Đã trả hết: {tên}", "Đã đánh dấu {tên} trả hết"                           | Sheet Chưa thanh toán, thông báo                          | 02                   |
| "Xem thêm", "Đang hiện {x} / {y} bill"                                                                | Cuối danh sách điện thoại                                 | 02 (QĐ 14)           |
| `aria-label` "Bỏ lọc ngày"                                                                            | ✕ chip khoảng ngày                                        | 02                   |
| "Không tải được danh sách người chơi."                                                                | Lỗi tải trong sheet chọn người                            | 03                   |
| "Đang lưu..."                                                                                         | Nút Lưu của Thêm nhanh khi đang gửi                       | 03                   |

Chữ cũ dùng ở chỗ mới: "Tổng tiệc", "Tiền tiệc", "Chi phí thêm", "Tiền thêm", "Đơn giá / mức", "Ghi chú", "Mức tính
{x}", "Đã chi {số}", "Tiền thêm {số}" (dòng phụ form), "Chia bill", "Thành tiền", "Tổng tiền", "Tổng người tham gia",
"Chưa có người tham gia.", "Tìm tên...", "Tìm theo tên/nội dung tiệc...", "Bill tiệc #{id}", "Quay lại danh sách", "Tất cả
đã thanh toán", câu `alert` cũ (nay ở thông báo / khối lỗi / dưới ô). Chữ bỏ trên điện thoại: "DS ngày thiếu:", "Số bill /
trang", nút "Hủy" ở thanh đáy form, "Mức: x" trong sheet chọn người.

## 4. Quyết định tự chọn

- **Đánh dấu thanh toán dùng `party_bills.update`** (QĐ 10; seeder chỉ có view / create / update / delete).
- **Breakpoint**: danh sách và chi tiết đổi dưới md (như 02, 04); ô "Chưa thanh toán" + sheet dưới lg, từ lg cột phải như
  cũ; form tạo / sửa dưới sm (như 03).
- **Sau khi đánh dấu, tải lại bill (im lặng)** như bill cầu: máy chủ tính lại nợ cũ (`debt_amount` chỉ có ở GET chi tiết).
  Trước đây màn thay người vừa đánh dấu bằng response của `pay` (không có nợ cũ) nên hàng / ảnh xuất mất cột nợ của người đó
  tới lần mở sau. Hàng cập nhật ngay (gộp response, giữ nợ cũ) rồi mới tải lại.
- Form: Enter trong ô không gửi form ở cả desktop (`focusNextOnEnter` của 03), form `noValidate` → lỗi tại ô thay bong bóng
  của trình duyệt; ô tiền khoản thêm bôi đen khi chạm (cả desktop). Bố cục desktop không đổi (so ảnh = 0 điểm khác).
- Không làm hỏi trước khi rời màn tạo / sửa (không có trong đề xuất 05; 03 có `useConfirmLeave` nếu chủ dự án muốn).
- Thêm nhanh: chặn chọn trùng người (chọn người đã có thì bỏ qua); vẫn không kiểm trùng tên khi tạo (như cũ).
- Sheet một người hiện mức tính dạng số (API trả chuỗi "1.000").
- ✕ của chip khoảng ngày thêm `z-10` tại chỗ vì lỗi CSS chung (mục 7.1).
- Đã merge `feature/giao-dien-mobile` (`ffc0464`, đợt dọn) theo yêu cầu PM và dùng `PageHeader hideOnPhone`, `ActionBar`
  `tone`, `.list-row-warn`. "Sửa bill" khi đã trả hết vẫn ẩn (đề xuất A19: "ẩn khi đã thanh toán hết, như hiện nay"), không
  dùng mục khóa có `description`.

**Tổng trên màn so với ảnh xuất (PM hỏi):** hiện nợ cũ **không** làm khớp. "Tổng tiệc" trên màn
(`partyBillTotals.js:24`, giữ công thức cũ của `PartyBillDetail.jsx` ~539) = tiền tiệc + chi phí thêm + Σ tiền thêm;
"Tổng tiền" của ảnh (`PartyBillExport.jsx:43`) = `total_amount` = tiền tiệc + chi phí thêm (`PartyBillRecalculator.php`).
Hai số lệch đúng Σ tiền thêm (bill #25: 38.250.000 so với 38.010.000); nợ cũ là số của từng người, không vào tổng bill.
Không sửa cách tính. Số **từng người** trên màn nay khớp cột "Tổng tiền" của ảnh.

## 5. API cho nhóm khác

Không có component dùng chung mới cho nhóm khác. Trong `components/party/` (chỉ bill tiệc): `PartyBillSummary`,
`PartyParticipantList`, `PartyBillList`, `PartyFilterSheet`, `PartyUnpaidSheet`, `PartyBillFormSections`
(`PartyBasicInfoCard`, `PartyExtrasCard`, `PartySummaryCard`, `PartyFormDesktopActions`, `PartyFormActionBar`),
`PartyParticipantsSection`, `PartyParticipantSheet` (+ `GenderTag`, `PaidTag`), `PartyQuickAddPlayer`, `usePartyBillForm`.
Dùng lại của nhóm khác, không sửa: `BillPlayerRow` / `BillPlayerTag`, `BillPaymentBadge`, `PlayerPickerSheet`,
`focusNextOnEnter` / `focusField`, `utils/billPlayers` (`filterBillPlayers`, `countBillPlayers`), `utils/playerSearch`
(`normalizeSearch`), `utils/billList` (`dateRangeLabel`), hai hộp dùng chung của 04.

## 6. Kiểm chứng (05/11/2026, trong `FRONTEND` của worktree)

| Cổng                                                               | Kết quả                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                                                         | 19 file, **235 passed**, 0 failed (trước: 17 / 211; thêm `partyBillList.test.js`, `partyBillTotals.test.js` — 24 ca)                                                                                                                             |
| `npx eslint .`                                                     | **2 lỗi + 6 cảnh báo** = mốc `eea5cd1`, cùng các file (2 cảnh báo `exhaustive-deps` có sẵn của `EditPartyBill`, `PartyBillDetail` giữ nguyên)                                                                                                    |
| Build (`VITE_API_URL=/api`, `tools/vite.no-repo-write.config.mjs`) | ok (cảnh báo chunk > 500 kB có sẵn)                                                                                                                                                                                                              |
| `git diff --stat feature/giao-dien-mobile...HEAD`                  | 18 file, chỉ `screens/party/*`, `components/party/*` (mới), `utils/partyBill*` (mới); file cũ sửa bằng script (danh sách, chi tiết) hoặc viết lại (tạo / sửa — đã prettier sạch)                                                                 |
| Cổng 6 — ảnh xuất                                                  | bill tiệc #25 (28 người, nợ cũ, thuê xe, ứng trước âm), #26, #19 (năm 2025) ở 1280 và 390 (390 qua "Gửi ảnh" → "Xuất Bill", bảng chia sẻ giả), so bản build `main` d438adb cùng máy chủ giả: **trùng từng byte** (`cmp`), đo lại trên bản cuối   |
| Desktop 1280 so `main` (cả trang)                                  | Tạo: **0 điểm khác**; Sửa #25: **0** (hai lượt chụp chính `main` tự lệch vài điểm chữ — nhiễu); Danh sách: chỉ dòng tiêu đề; Chi tiết #25 / #26: trên y = 562 (đầu màn, nút, Thông tin Bill, Chi phí thêm) trùng, khác từ bảng người (cột Nợ cũ) |

Việc chính (điện thoại, máy chủ giả, script đếm; giống nhau ở 360 / 390 / 430):

| Việc                                                                | Cũ (đo ở bước 1)                  | Đề xuất A    | **Bản build**                                                                                               |
| ------------------------------------------------------------------- | --------------------------------- | ------------ | ----------------------------------------------------------------------------------------------------------- |
| 1. Tạo bill tiệc 15 người, món chung 350.000 + tiền xe 600.000, lưu | 23 chạm, 5 ô gõ, trang ≈ 5.000 px | 24 chạm, 5 ô | **25 chạm** (FAB, ô Tên, Enter × 5, Chọn người, 15, Xong, Tạo), **5 ô gõ**; lưu thành bill #28, 5.150.000 ₫ |
| 2. Mở bill, đánh dấu 2 người đã trả, gửi ảnh vào nhóm               | 6 chạm + cuộn ngược ~1.500 px     | 5 chạm       | **5 chạm** (hàng, Đã TT × 2, Gửi ảnh, Gửi Telegram), không cuộn ngược; +1 chạm mỗi người có nợ cũ           |

Ảnh (máy chủ giả cổng 4105 + `fixtures-05.mjs`; không chạm máy chủ thật), thư mục
`/private/tmp/claude-501/-Users-admin-Desktop-Github-APACTech-BadmintonNew/0c1bebe2-0704-4215-bcf9-7308f4798c3d/scratchpad/trien-khai/05-bill-tiec/anh/`:

- `viec-1/` — việc 1 ở 360 / 390 / 430: mở màn, khoản thêm, sheet, 15 người, hàng ngoại lệ, sheet một người, bill đã lưu.
- `viec-2/` — việc 2: mở bill #25, đang lưu, đã TT 2 người, hộp Gửi ảnh bill, đã gửi + thông báo; hộp nợ cũ, lọc Đã TT,
  Bỏ đánh dấu, mở chi tiết người có nợ cũ, lỗi gửi Telegram.
- `kho/` — 360 / 390 / 430 / 1280 cả trang: danh sách, #25 (28 người, tên ~30 ký tự, 38.250.000 ₫, nợ cũ, thuê xe, ứng
  trước âm), #26, #19 (2025), #24 (đã thu đủ), tạo, sửa #25 (khoản Thuê xe, người đã TT); sheet Lọc, kết quả lọc, lọc rỗng,
  sheet Chưa thanh toán, hộp trả hết, sau trả hết, Thông tin Bill, ⋯, hộp xóa, lỗi form (tên / người), tìm không ra, thêm
  nhanh, sheet người đã TT.
- `rong/` — dataset rỗng (danh sách, tạo, chi tiết không có); `loi/` — lỗi tải danh sách / chi tiết / màn sửa;
  `quyen/` — profile `limited` 360 / 390 / 1280.
- `xuat/` — `main/`, `nhanh-cuoi/` (file PNG), `nhanh-shots/`; `so-main/` — desktop hai bản + ảnh khác biệt.

Chưa kiểm được (cần máy thật): bảng chia sẻ thật iOS / Android, sheet + bàn phím ảo, Enter / "Tiếp" trên bàn phím số
iOS (`enterKeyHint`), cuộn chip dính trên iOS Safari.

## 7. Thấy khi làm, ngoài phạm vi (không sửa)

### 7.1 Cần PM / nhóm khác

- **`index.css:313` `.chip::after` che nút ✕ trong `.chip-applied`** (`.chip-remove`, `index.css:334`): `elementFromPoint`
  giữa nút ✕ trả về `span.chip`, bấm ✕ không có tác dụng. Đang lỗi ở **Bill cầu** `Dashboard.jsx:560` (đã thử trên bản build).
  Bill tiệc sửa tại chỗ bằng `z-10`. Đề xuất sửa chung: `.chip-remove { z-index: 1 }` (hoặc bỏ `::after` của `.chip-applied`).

### 7.2 Có sẵn từ trước

- `utils/partyBillList.js:70` (chuyển nguyên từ `PartyBills.jsx:209`): lọc "Đến ngày" so chuỗi `"2026-10-24T00:00:00.000000Z" <=
"2026-10-24"` → bill đúng ngày cuối bị loại (máy chủ giả trả ngày dạng này; giả thuyết — chưa kiểm trên máy chủ thật).
- `PartyBillFormSections.jsx:259` (cũ `CreatePartyBill.jsx:647`): "SUM mức tính" in số thực thô "24.099999999999994" (bill
  có mức 0.7). Có cả ở `main`.
- `PartyBills.jsx:177`: "Đã trả hết" gửi song song từng bill; một bill lỗi thì bill khác đã đổi nhưng màn báo lỗi chung,
  không tải lại (đề xuất bước 1 đã ghi).
- `PartyQuickAddPlayer.jsx:51` (cũ `CreatePartyBill.jsx:158`): thêm nhanh tạo tài khoản mật khẩu "password", email đoán được.
- `BACKEND/routes/api.php:65`, `:75`: xóa / đánh dấu bill tiệc chỉ cần đăng nhập — ẩn nút (QĐ 10) chỉ là giao diện (spec mục 7).
- Hộp nợ cũ dùng chung chỉ in ngày, không in tên bill tiệc cũ (`debt_details` có `name`); phần mở trên hàng có tên.
