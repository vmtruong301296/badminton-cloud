# 03 Bill cầu: Tạo / Sửa, triển khai (đợt 1, phương án A)

Ngày: 2026-11-05 · Nhánh `feature/mobile-03-tao-sua` (tách từ `91fd4a4`) · Spec: `../2026-11-05-giao-dien-mobile-design.md`
(mục 2, 2.1 nhóm 03) · Đề xuất: `03-bill-cau-tao-sua-de-xuat.html`, phương án A · Chủ dự án duyệt hướng 05/11/2026.

Chỉ frontend. Không đổi route, quyền, API, payload `POST/PUT /bills`, cách tính xem trước. Thay đổi giao diện nằm
dưới `sm` (640 px) trừ các chỗ ghi ở mục 2.

## 1. Đã làm

- **Một trang cuộn.** Thanh trên M1 qua `PageHeader` (‹, không có ⋯). Thanh dưới `ActionBar` (M2):
  "Tổng tiền · N người" + số tiền (chạm mở sheet Tóm tắt Bill, chân sheet có nút lưu), nút "Tạo Bill" /
  "Lưu thay đổi". "Hủy" thành ‹; đã nhập thì hỏi lại bằng `ConfirmDialog`.
- **Thông tin cơ bản:** ngày + tiền sân cùng hàng, ngày in kiểu M6 "T5, 05/11"; giữ 3 mức sân và gợi ý ×1000.
- **Loại cầu:** mỗi dòng một hàng tên ▾ · số lượng · ×, dòng phụ "Khả dụng: N quả" + thành tiền; tiêu đề cột một
  lần; giữ câu vượt tồn và "(đã tính hoàn từ bill này)". Tên cầu dài cắt "…"; bảng chọn gốc vẫn có giá / tồn.
- **Người chơi:** đầu khối "Người chơi (N)" dính dưới M1 + "Chọn người chơi" (mở `PlayerPickerSheet`). Mỗi người
  một hàng mở tại chỗ (M3c, mỗi lúc một hàng). Hàng có #STT màu nam/nữ, nền xanh/hồng theo giới tính, nhãn Nam/Nữ,
  ×mức tính, tiền cộng thêm, "Nợ: …", "Đã TT" (màn sửa) và số tiền xem trước làm tròn nghìn. Phần mở gồm:
  - "Mức tính": 6 nút 0.4–1, ô mức khác, "Mặc định: x" (màn tạo);
  - "Cộng thêm": nội dung + số tiền;
  - "Menu nước" một hàng + "Thêm nhanh menu";
  - "Bỏ khỏi bill" / "Xong".
- **Nhập liên tục:** chạm ô số là bôi đen cả số (`selectOnFocus`). Enter nhảy ô kế: tiền sân → số quả cầu 1 → cầu 2;
  nội dung cộng thêm → số tiền; ô cuối đóng bàn phím. Enter trong ô nhập không còn gửi bill.
- **Lỗi:**
  - kiểm form báo dưới ô (M14), giữ nguyên câu cũ, cuộn tới và đặt con trỏ vào ô sai đầu tiên;
  - lỗi máy chủ là toast (M8) có "Thử lại";
  - thêm nhanh người chơi / menu báo lỗi trong hộp.

  Bỏ đủ 19 `alert()` trong phạm vi.

- **Sửa bill:** dải cảnh báo "{n} người đã TT trong bill này. Lưu thay đổi sẽ đưa họ về Chưa TT."; khung xương có
  M1 + M2 mờ; lỗi tải là M13 có "Thử lại".
- **Bill con:** giữ cách điền sẵn (280k + 2 dòng cầu); câu gợi ý dưới Ghi chú; "Chọn cả N người bill chính" trong
  sheet.
- **Nhãn:** "Unit price" → "Tiền cho mức 1" (cả desktop).

Giữ đủ tính năng mới nhất:

| Tính năng                                   | Ở đâu sau khi đổi                                                                                                    |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 280k + cầu Thành Công mặc định              | không đổi logic                                                                                                      |
| mức 0.4 và 6 nút chọn nhanh                 | hàng mở tại chỗ + thẻ desktop                                                                                        |
| #STT, màu nam / nữ                          | hàng và thẻ                                                                                                          |
| tiền cộng thêm kèm nội dung                 | hàng mở tại chỗ + thẻ desktop                                                                                        |
| "TT + Bill sau", nền riêng người nhiều bill | thuộc màn chi tiết (`BillContent.jsx`, nhóm 04), không đụng; ở màn tạo bill con giữ nghĩa qua câu gợi ý dưới Ghi chú |

## 2. Chỗ chệch bản vẽ và lý do

| #   | Bản vẽ                                          | Triển khai                                                                                    | Lý do                                                                                       |
| --- | ----------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| 1   | A13: dải cảnh báo "Đã TT" (vẽ điện thoại)       | Hiện cả desktop                                                                               | Desktop sửa bill cũng mất "Đã TT"; đổi lại chỉ cần thêm `sm:hidden`                         |
| 2   | A12: câu gợi ý dưới Ghi chú bill con            | Hiện cả desktop                                                                               | Cùng lý do; desktop chỉ dài thêm 42 px ở cột trái                                           |
| 3   | A5: Giới tính thành 2 nút Nam / Nữ              | Chỉ điện thoại; desktop giữ ô chọn                                                            | Desktop giữ bố cục                                                                          |
| 4   | A9: gợi ý ×1000 dưới giá menu                   | Có ở cả hộp desktop                                                                           | Hộp dùng chung                                                                              |
| 5   | A10: lỗi tiền sân dưới ô                        | Lỗi trải hết bề ngang, ngay dưới hàng ngày / tiền sân                                         | Ô tiền sân chỉ nửa hàng, câu lỗi 4 dòng nếu ép vào                                          |
| 6   | A11: "{n} người chơi và số cầu đã nhập sẽ mất." | Khi chưa có người dùng "Các thay đổi chưa lưu sẽ mất."                                        | Tránh "0 người chơi…"; câu này đã gật cho màn sửa. Chưa nhập gì thì ‹ đi thẳng              |
| 7   | A6: nền phần mở trắng                           | Nền `slate-50` của `.list-row-panel` (M3c)                                                    | Dùng class chung                                                                            |
| 8   | A14: khung xương dạng hàng                      | Giữ khung xương cũ, thêm M1 "Sửa Bill #id" + M2 "Tổng tiền —" mờ                              | Desktop giữ đúng khung xương cũ                                                             |
| 9   | Ngày "T5, 05/11" trong ô                        | Chữ in phủ lên ô ngày gốc trong suốt (chạm vẫn mở lịch của máy)                               | Ô `type="date"` không in được định dạng tự chọn; `DatePicker` là file nhóm 01               |
| 10  | Tên cầu "Cầu S70" trong ô chọn                  | Chữ tên phủ lên ô chọn trong suốt                                                             | Chữ của `<option>` có giá / tồn cho desktop                                                 |
| 11  | Thêm nhanh trùng tên: toast M8                  | Khi sheet chọn đang mở: dòng thông báo trong sheet; khi không: toast                          | Toast nằm dưới lớp nền mờ của sheet                                                         |
| 12  | (không vẽ)                                      | Nút ‹ trên thanh trên bị chặn bằng listener pha capture của document                          | `AppBarBackLink` (nhóm 01) chưa có `onClick`; xem mục 7.1                                   |
| 13  | (không vẽ)                                      | Nút Back của trình duyệt chưa hỏi lại (chỉ ‹, link về cùng chỗ, "Hủy" desktop, tải lại trang) | App dùng `BrowserRouter`, không có `useBlocker`                                             |
| 14  | (không vẽ)                                      | Đầu khối dính dùng `overflow-clip` trên điện thoại                                            | `overflow-hidden` làm `sticky` không chạy; iOS < 16 không có `clip` (góc dưới có thể vuông) |

Hành vi desktop đổi (bố cục giữ nguyên):

- Enter trong ô nhập không gửi bill (trước đây Enter ở ô tiền sân / ô tìm là tạo bill ngay).
- "Hủy" và link "‹ Danh sách" hỏi lại khi đã nhập.
- Bôi đen khi chạm cũng áp ở desktop: tiền sân, số lượng cầu, số lượng món.
- Lỗi hiện tại ô thay cho `alert()`.
- Lỗi tải danh sách người chơi hiện câu lỗi + "Thử lại", thay cho câu báo nhầm "Không còn người chơi nào".

## 3. Chữ phát sinh ngoài danh sách đã gật

| Chữ                                             | Ở đâu                                            | Ghi chú                                |
| ----------------------------------------------- | ------------------------------------------------ | -------------------------------------- |
| `aria-label` "Xóa tìm kiếm"                     | nút × trong ô tìm của sheet chọn người           | bản vẽ A3 có nút × nhưng chưa ghi nhãn |
| "Đang lưu..."                                   | nút Lưu của "Thêm nhanh người chơi" khi đang gửi | chữ cũ của "Thêm nhanh menu"           |
| "Không thể tải dữ liệu bill để sửa" + "Thử lại" | khối lỗi M13 màn sửa                             | câu `alert()` cũ                       |

Chữ cũ dùng lại ở chỗ mới, không phải chữ mới:

- `aria-label` "Thêm" của nút + chỉ có biểu tượng (menu nước, điện thoại).
- "Tổng tiền" khi chưa có người, "—" khi đang tải.
- Câu trùng tên người chơi cũ, nay hiện trong sheet.
- "Không tải được danh sách người chơi." ở cột desktop.

## 4. Quyết định tự chọn

File mới ngoài danh sách đề xuất, để không chép JSX đáp ứng hai cỡ màn vào cả CreateBill lẫn EditBill:

- `BillFormSections.jsx`: `BillBasicInfoCard`, `BillShuttlesCard`, `BillActionBar`.
- `BillPlayersSection.jsx`: khối người chơi; giữ hàng nào đang mở và sheet.
- `billFormFocus.js`: Enter nhảy ô; cuộn tới ô lỗi.
- `useConfirmLeave.js`: hỏi lại khi rời màn.

`CreateBill` còn 453 dòng (trước 588), `EditBill` còn 580 (trước 737).

Cách làm:

- **Hai bố cục bằng CSS** (`sm:hidden` / `hidden sm:block`). Hàng điện thoại là `PlayerBillRow`, export kèm trong
  `PlayerBillCard.jsx`. Ô trong phần mở có id riêng (`player-row-*`) nên không trùng id với thẻ desktop.
- **EditBill:** xem trước chuyển từ effect + state sang `useMemo` (`buildEditPreview`, giữ nguyên công thức). Bỏ
  khối tính trùng trong `loadInitialData`. Màn tạo tính xem trước cả khi chưa có người để M2 luôn có tổng; cột Tóm
  tắt desktop vẫn chỉ hiện khi có người như cũ.
- **Cập nhật state:** form cập nhật theo state mới nhất (`setFormData(prev => …)`), để "Chọn cả N người bill chính"
  thêm nhiều người một lượt. Thêm người trùng `user_id` bị bỏ qua.
- **"Đã TT":** `is_paid` được map vào người chơi của màn sửa, chỉ để hiện "Đã TT" và dải cảnh báo; payload không đổi.
- **Câu lỗi máy chủ** đọc `data.message`, rồi `data.error` (`BillController` trả `{ error }` khi lỗi 500).
- **Lỗi tải màn sửa** hiện M13 tại chỗ, không `alert` + chuyển về trang chủ như trước.
- **Sheet Tóm tắt Bill:** bấm lưu trong sheet thì đóng sheet đồng bộ (`flushSync`) rồi `requestSubmit()`. Nếu đóng
  trong `onClick` thì nút bị gỡ trước khi form được gửi; lỗi này tìm ra khi chụp và đã sửa ở `c9d893b`.

## 5. API cho nhóm khác

### 5.1 `PlayerPickerSheet` (nhóm 05 dùng lại ở đợt 2)

`components/bill/PlayerPickerSheet.jsx`: sheet chọn nhiều (M5).

- Chạm hàng là tick / bỏ tick, hàng đứng yên.
- Người đã chọn lên đầu, chụp lại mỗi lần mở.
- Ô tìm không tự bật bàn phím, gõ không dấu. Enter chọn kết quả đầu chưa chọn (viền xanh), xóa ô, giữ con trỏ.
- Tìm không ra thì có nút tạo người mới mang sẵn tên.

**Màn cha giữ danh sách đã chọn và tự tải người chơi**; sheet chỉ giữ chữ đang tìm.

| Prop                             | Kiểu                       | Mặc định                       | Ý nghĩa                                                                                                                                                                            |
| -------------------------------- | -------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isOpen`, `onClose`              |                            |                                | mở / đóng (nút chân và × đều gọi `onClose`)                                                                                                                                        |
| `players`                        | mảng `GET /players`        | `[]`                           | `{ id, name, gender, default_ratio_value, bill_count, current_debt_amount }`, giữ thứ tự API                                                                                       |
| `selectedIds`                    | `number[]`                 | `[]`                           | `user_id` đang có trong bill                                                                                                                                                       |
| `onToggle(player, nextSelected)` |                            |                                | `true` = thêm, `false` = bỏ; màn cha tự dựng người tham gia (mức tính…)                                                                                                            |
| `loading` / `error` / `onRetry`  | bool / string \| null / fn |                                | đang tải; câu lỗi tải (M13 trong sheet + "Thử lại")                                                                                                                                |
| `showRatio`                      | bool                       | `true`                         | `false` ẩn ": 1" → chỉ "Nam" / "Nữ" (**bill tiệc**, quyết định 2.1)                                                                                                                |
| `scopeIds`                       | `number[]` \| null         | `null`                         | chưa gõ thì chỉ hiện những người này (bill con)                                                                                                                                    |
| `title`                          | string                     | "Chọn người chơi"              | tiêu đề sheet                                                                                                                                                                      |
| `doneLabel(count)`               | fn                         | `` n => `Xong · ${n} người` `` | chữ nút chân                                                                                                                                                                       |
| `searchPlaceholder`              | string                     | "Tìm kiếm người chơi..."       |                                                                                                                                                                                    |
| `onQuickAdd(name)`               | fn                         | —                              | có thì hiện "Thêm nhanh" (name `""`) và "Thêm "tên" làm người chơi mới" (name = chữ đã gõ). Màn cha mở hộp thêm nhanh của mình **chồng lên sheet**, lưu xong tự gọi chọn người mới |
| `bulkAction`                     | `{ label, onClick }`       | —                              | nút chọn cả nhóm trên danh sách                                                                                                                                                    |
| `notice`                         | node                       | —                              | dòng thông báo trong sheet (toast M8 nằm dưới lớp nền mờ)                                                                                                                          |

Ví dụ cho bill tiệc (chữ theo đề xuất 05: "Chọn người", chân "Xong"):

```jsx
import PlayerPickerSheet from "../../components/bill/PlayerPickerSheet";

<PlayerPickerSheet
  isOpen={pickerOpen}
  onClose={() => setPickerOpen(false)}
  title="Chọn người"
  doneLabel={() => "Xong"}
  players={players} // màn tự playersApi.getAll()
  selectedIds={form.participants.map((p) => p.user_id)}
  onToggle={(player, selected) =>
    selected
      ? handleSelectPlayer(player) // ratio_value: 1 như hiện nay
      : removeParticipant(
          form.participants.findIndex((p) => p.user_id === player.id),
        )
  }
  loading={loadingPlayers}
  error={playersError ? "Không tải được danh sách người chơi." : null}
  onRetry={loadPlayers}
  showRatio={false}
  onQuickAdd={(name) => openAddPlayer(name)}
/>;
```

Hàm thuần đi kèm, đều có test: `utils/playerSearch.js`.

- `normalizeSearch`, `matchesPlayerSearch`;
- `filterPickerPlayers`, `orderPickerPlayers`, `firstUnselectedPlayer`;
- `findPlayerByName` (kiểm trùng tên khi thêm nhanh; `CreatePartyBill.jsx` hiện chưa kiểm trùng).

### 5.2 Dùng lại được cho form khác (bill tiệc)

- **`useConfirmLeave({ when, backTo })`**: trả `{ isOpen, requestLeave(to?), cancel, confirm }` để dựng
  `ConfirmDialog`.
  - Tự chặn link tới `backTo`, gồm nút ‹ trên thanh trên.
  - Bắt `beforeunload` (tải lại / đóng tab).
- **`focusNextOnEnter`** (`onKeyDown` của `<form>`):
  - ô có `data-next="<nhóm>"` thì Enter sang ô kế cùng nhóm;
  - mọi ô khác thì Enter không gửi form.
- **`focusField(key)`**: cuộn tới phần tử `data-field="<key>"` đang hiện và đặt con trỏ vào đó.
- **`billFormErrorList`** (`utils/billFormErrors.js`): mẫu trả lỗi theo thứ tự trên màn. Riêng bill cầu, không dùng
  nguyên cho bill tiệc.

## 6. Kiểm chứng

Cổng (trong `FRONTEND`, 05/11/2026):

| Cổng                                                                            | Kết quả                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test`                                                                      | 10 file, **123 passed**, 0 failed (trước: 94; thêm 29 test `playerSearch` + `billFormErrors`)                                                                                                                                         |
| `npx eslint .`                                                                  | **3 lỗi + 6 cảnh báo** (mốc 3 + 8). Bớt 2 cảnh báo `exhaustive-deps` cũ của `CreateBill.jsx`; không thêm gì                                                                                                                           |
| `VITE_API_URL=/api npx vite build --config tools/vite.no-repo-write.config.mjs` | ok (cảnh báo chunk > 500 kB có sẵn)                                                                                                                                                                                                   |
| `git diff --stat 91fd4a4`                                                       | chỉ file nhóm 03 + 4 file mới cùng thư mục `components/bill/`. Mọi file qua `prettier --check`. `BillSummary.jsx` 143 dòng vì bọc khối "Chi tiết từng người" trong điều kiện (thụt lề); `git diff -w` chỉ còn 21 dòng          |
| Desktop 1280 so với bản build `91fd4a4` (cùng máy chủ giả)                      | Màn tạo: **khác 2 điểm ảnh** (nhiễu, lần chạy trước 1 điểm). Bill con: thêm câu gợi ý 42 px. Sửa 176 / 179: thêm dải cảnh báo 70 px; dưới dải chỉ khác chữ "Tiền cho mức 1" (714 điểm) và nhiễu 1–3 điểm rải rác. Không ô nào đổi chỗ |

Số lần chạm, đếm thật bằng script trên bản build qua máy chủ giả (giống nhau ở 360 / 390 / 430):

| Việc                                                                | Cũ (đo ở bước 1)                   | Đề xuất A (ước)   | **Bản build**                      |
| ------------------------------------------------------------------- | ---------------------------------- | ----------------- | ---------------------------------- |
| 1. Tạo bill 12 người, sửa số quả 2 loại cầu, 1 người cộng thêm, lưu | 21 chạm · 25 phím · cuộn ~8.100 px | 16 chạm · 25 phím | **15 chạm · 27 phím**, 5 ô phải gõ |
| 2. Sửa bill: thêm 1 người (tìm 3 chữ), đổi mức tính người #5, lưu   | 4 chạm · 3 phím · cuộn ~3.700 px   | 6 chạm · 4 phím   | **6 chạm · 4 phím**, 1 ô phải gõ   |

Cách đếm việc 1:

| Bước       | Chạm | Phím | Ghi chú                                                                                                                      |
| ---------- | ---- | ---- | ---------------------------------------------------------------------------------------------------------------------------- |
| Số quả cầu | 1    | 5    | chạm ô cầu 1, "10", Enter sang ô cầu 2, "6", Enter. Enter thay một lần chạm; Enter cuối chỉ để đóng bàn phím, không bắt buộc |
| Chọn người | 11   | 16   | "Chọn người chơi", 8 tick, chạm ô tìm, 4 × (3 chữ + Enter), "Xong"                                                           |
| Cộng thêm  | 2    | 6    | mở hàng #7, chạm ô nội dung (chữ nội dung không đếm, như đề xuất), Enter, "10000"                                            |
| Lưu        | 1    |      | "Tạo Bill"                                                                                                                   |

Đã lưu thật vào máy chủ giả: bill #181 (12 người, 665.000 ₫) và sửa #176.

Ảnh (máy chủ giả cổng 4103, profile admin; không chạm máy chủ thật), thư mục
`/private/tmp/claude-501/-Users-admin-Desktop-Github-APACTech-BadmintonNew/0c1bebe2-0704-4215-bcf9-7308f4798c3d/scratchpad/trien-khai/03-bill-cau-tao-sua/anh/`:

- **Việc 1** `v1-01…08-{360,390,430}`: mở màn, sheet 8 người, tìm, 12 người, hàng #7 mở, cả trang 12 người,
  tóm tắt, chi tiết sau khi lưu.
- **Việc 2** `v2-01…05-{360,390,430}`: sửa #176, dải "6 người đã TT", tìm + thêm, #5 đổi 0.6, cả trang, sau khi lưu.
- **Bill 25 người** `h25-*`: tiền sân 9.800.000, 120 + 100 quả (vượt tồn), tổng 15.050.000 ₫, tên ~30 ký tự,
  "Nợ: 230.000 ₫ / 500.000 ₫", cộng thêm 150.000. Có `m-06/07-sua-179-*` (sửa bill 25 người có 6 người đã TT).
- **Lỗi M14** `e-01…02-*`: số lượng 0 dưới dòng cầu, chưa chọn người, tiền sân 0. Cùng nhóm:
  - `e-03` hỏi rời màn; `e-04` toast lỗi máy chủ;
  - `x-01…03` lưu từ sheet tóm tắt khi còn lỗi, hỏi rời màn sửa.
- **Sheet** `s-01…08`: mở, không tìm thấy, thêm nhanh người (Nam / Nữ), sau khi thêm, trùng tên (thông báo trong
  sheet), tên trống, lỗi tải danh sách, thêm nhanh menu + gợi ý ×1000.
- **Bill con, rỗng, quyền:**
  - `m-01…03`: bill con, sheet giới hạn bill chính, "Chọn cả 13 người bill chính";
  - `m-04` / `m-05`: màn sửa đang tải / lỗi tải;
  - `r-*`: dữ liệu rỗng;
  - `l-*`: profile limited, không có `bills.create` / `bills.update` nên ra màn "Không có quyền truy cập".
- **Desktop** `d-01…04-1280`: lỗi người chơi ngay trên hai cột, chọn 2 người, Hủy hỏi lại, thêm nhanh giữ ô chọn.
  So bản `91fd4a4` bằng `base-*-1280` / `nhanh-*-1280`.

Script tái chạy: `flow.mjs` (kịch bản + đếm chạm), `fixtures-03.mjs` (lỗi tải, đang tải, lỗi 500 `{ error }`),
`compare-shift.mjs` (so điểm ảnh desktop), cùng thư mục.

Chưa kiểm được, cần máy thật:

- chữ phủ lên ô ngày / ô loại cầu khi chạm trên iOS và Android;
- sheet và bàn phím;
- `overflow-clip` trên iOS < 16.

## 7. Lỗi / việc ngoài phạm vi (không sửa)

### 7.1 Cần nhóm 01 / PM

- **`components/ui/AppBar.jsx:9`, nút ‹ không nhận `onClick`.** Màn tạo / sửa phải chặn bằng listener pha capture
  (`useConfirmLeave.js`). Đề xuất `back.onClick` (hoặc `onBack`) cho `PageHeader` / `AppBar`, rồi bỏ listener.
- **`components/ui/Modal.jsx:76-78`, hai hộp chồng nhau đóng cả hai khi bấm Esc.** `stopPropagation` không chặn
  listener khác trên document; cần `stopImmediatePropagation`. Chỉ ảnh hưởng bàn phím vật lý. Ví dụ: sheet chọn
  người + "Thêm nhanh người chơi".
- **Class chung có thể gom:** hàng chọn có vòng tick 24 px (sheet chọn nhiều), dòng thông báo trong sheet
  (`bg-sky-50`), dải cảnh báo amber. Nay viết Tailwind tại chỗ trong `PlayerPickerSheet.jsx` / `EditBill.jsx`.

### 7.2 Có sẵn từ trước

- **Xem trước không tính nợ ghi tay.**
  - `CreateBill.jsx:182` đặt `debt_amount: 0` khi xem trước.
  - Lúc lưu, `BillController.php:121, :182` cộng `getCurrentDebtAmount()` (`User.php:71-73`, nợ ghi tay chưa giải
    quyết) vào `total_amount`.

  Người có "Nợ: …" trên hàng sẽ có số sau khi lưu lớn hơn số trên hàng. Đề xuất bước 1 ghi đây là giả thuyết; nay đã
  đọc code xác nhận đường lưu, chưa chạy trên máy chủ thật. Có thể ghi "chưa gồm nợ" hoặc cộng vào xem trước: việc
  riêng, chủ dự án quyết.

- **Ngày bill không lọt vào `as_of`.** `CreateBill.jsx:82`, `EditBill.jsx:207`, `:310` gọi
  `shuttlesApi.getAll({ params: { as_of } })` bọc hai lần → `?params[as_of]=…` (nhóm 01 đã ghi). Giữ như cũ.
- **Ngày mặc định theo UTC.** `CreateBill.jsx:61`, `:129` dùng `toISOString()`; mở màn trước 07:00 giờ VN ra ngày
  hôm qua. Spec 2.1 giữ như cũ.
- **Thêm nhanh tạo tài khoản mật khẩu cố định.** `PlayerSelector.jsx:211` (và `CreatePartyBill.jsx`) dùng
  "password", email đoán được.
- **Thêm nhanh của bill tiệc làm riêng.** `CreatePartyBill.jsx:145-175` có hộp thêm nhanh riêng, không kiểm trùng
  tên. Nếu nhóm 05 dùng sheet, nên tách hộp "Thêm nhanh người chơi" của `PlayerSelector.jsx` thành component chung.
  `PlayerSelector.jsx` nay 565 dòng, quá ngưỡng ~400.
- **Sửa bill đặt lại "Đã TT"** (`BillController.php` ~440–486): đã có dải cảnh báo; sửa backend là việc riêng (spec
  mục 7).
