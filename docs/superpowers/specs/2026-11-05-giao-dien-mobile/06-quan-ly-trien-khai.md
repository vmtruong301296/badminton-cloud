# 06 Quản lý — triển khai (đợt 1, phương án B)

Ngày: 2026-11-05 · Nhánh `feature/mobile-06-quan-ly` (tách từ `91fd4a4`) · Spec: `../2026-11-05-giao-dien-mobile-design.md` ·
Đề xuất: `06-quan-ly-de-xuat.html`, mục "Phương án B — nhẹ hơn" · Chủ dự án duyệt hướng 05/11/2026.

B giữ dạng thẻ và nút như cũ, chỉ bớt chiều cao, sửa chỗ vỡ và lỗi màu. Thay đổi bố cục nằm dưới `md` (nhánh thẻ
`md:hidden` có sẵn) hoặc dưới `sm` (sheet sửa vai trò). Desktop chỉ đổi tiêu đề màn (quyết định 4) và nhãn nhóm quyền
trong sheet sửa vai trò. Không đổi route, quyền, API, cách tính. Không sửa backend.

## 1. Đã làm

| Màn                                  | Trước (đo ở máy chủ giả, 390 px)                                                                 | Sau                                                                                                                                                                                                                    |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tiêu đề                              | "Quản lý Người chơi", "Quản lý Master", "Quản lý Quyền"                                          | "Người chơi", "Master", "Quyền", cả desktop (quyết định 4). Thanh trên điện thoại hiện đúng nhãn tab, không lặp tiêu đề trong nội dung. 4 tab con của Master giữ `h2`                                                  |
| Master: dải tab                      | 360 px: rộng 358 trong khung 328, "TK nhận tiền" bị cắt                                          | Dưới 400 px chữ 13 px, đệm 4 px: `scrollWidth = clientWidth` ở 360 / 390 / 430 (328/328, 358/358, 398/398)                                                                                                             |
| Người chơi: thẻ                      | 249 px (email, 3 dòng "Giới tính / Mức tính / Quyền", 3 nút chữ): thấy trọn 1 người              | 132 px: tên + mức tính bên phải, một hàng nhãn (giới tính màu như thẻ bill, "Nợ: …" rose, quyền xám), Sửa / Quyền + nút thùng rác. Thấy 4–5 người                                                                      |
| Người chơi: lọc                      | Ô tìm và ô giới tính trong một thẻ, 2 hàng                                                       | Một hàng, không khung thẻ (dưới md); từ md giữ thẻ 2 cột như cũ                                                                                                                                                        |
| Người chơi: nút đầu màn              | "Thêm nhanh", "Thêm" co theo chữ                                                                 | Chia đều một hàng trên điện thoại (bản vẽ B)                                                                                                                                                                           |
| Loại cầu: thẻ                        | 195 px (360: 239–259 vì 5 nút xếp 3 hàng); tồn kho số thường                                     | 130–154 px: tên + giá, "Tồn kho" tô rose khi ≤ 0 (cả âm), amber khi dưới 10 ống; "Nhập kho" + ⋯ mở sheet Lịch sử / Lên giá / Sửa / Xóa. Tài khoản chỉ xem: thẻ không có hàng nút                                       |
| Loại cầu: banner sắp hết             | 4 dòng có câu "Vui lòng bấm “Nhập kho” để bổ sung."                                              | Điện thoại bỏ câu nhắc (2–3 dòng); desktop giữ nguyên câu                                                                                                                                                              |
| Quyền: sửa vai trò                   | Khung cuộn lồng 384 px trong sheet; nhóm mã tiếng Anh a→z ("Users" đứng cuối); ô tích xanh dương | Dưới sm không khung lồng, cả sheet cuộn một lần; 10 nhóm tên menu theo thứ tự menu; ô tích emerald (`accent-color` của đợt 0, đã kiểm ở Quyền, Gán quyền, Mức tính, TK nhận tiền). Từ sm giữ khung cũ, nhãn tiếng Việt |
| Tab Loại cầu / TK nhận tiền: đầu tab | 360 px (Loại cầu), 390 px (TK nhận tiền): nút "Thêm …" rơi xuống hàng riêng                      | Tiêu đề `h2` tự xuống 2 dòng bên trái nút                                                                                                                                                                              |

Hàm thuần mới (viết test trước): `utils/permissionGroups.js` (nhãn + thứ tự nhóm quyền), `utils/shuttleStock.js`
(ống / quả, ngưỡng 10 ống, `stockLevel`). Component mới: `screens/shuttles/ShuttleActionsSheet.jsx` (sheet ⋯, dùng
`.menu-row` M15 và `Modal initialFocus="panel"`).

Ba việc chính (đếm như đề xuất):

| Việc                                 | Trước             | Sau (B)                                                                                |
| ------------------------------------ | ----------------- | -------------------------------------------------------------------------------------- |
| Thêm nhanh 3 người (2 nam, 1 nữ 0.7) | 9 chạm · 5 ô      | 9 chạm · 5 ô (B không đổi luồng thêm nhanh)                                            |
| Nhập kho 10 ống cho một loại cầu     | 5 chạm + 0–2 vuốt | 5 chạm, thẻ gọn nên ít vuốt hơn                                                        |
| Bật "Xóa người chơi" cho một vai trò | 5 chạm + ≈ 6 vuốt | 5 chạm + ≈ 1 vuốt: ô ở 874 px trong vùng cuộn 623 px (390), nhóm cuối "Quyền" ≈ 4 vuốt |

## 2. Chỗ chệch bản vẽ và lý do

| #   | Bản vẽ B                                                | Triển khai                                                                           | Lý do                                                                                                                                                                 |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ô giới tính ghi "Tất cả"                                | Giữ chữ cũ "Tất cả giới tính", ô tự co theo chữ (`w-auto`)                           | Không thêm chữ mới; ở 360 px ô tìm vẫn đủ chỗ cho "Tìm kiếm tên..."                                                                                                   |
| 2   | Mọi người có "×1", "×0.7"…                              | Chưa đặt mức riêng thì in "Mặc định" (chữ cũ) màu xám, đặt rồi in "×0.7" đậm         | Dữ liệu thật đa số chưa đặt mức; không đoán giá trị; "×{mức}" là kiểu của thẻ bill (`PlayerBillCard`)                                                                 |
| 3   | Thẻ người chơi không có email, không có "Chưa có quyền" | Như bản vẽ (chỉ ở thẻ điện thoại)                                                    | Email tự sinh dài, xuống 2 dòng; vẫn xem / sửa được trong "Sửa" và bảng desktop. Desktop vẫn in "Chưa có quyền"                                                       |
| 4   | Nhãn Nam / Nữ nhạt                                      | `bg-sky-100 text-sky-700` / `bg-pink-100 text-pink-700`                              | Cùng màu nhãn giới tính của thẻ người chơi ở màn bill                                                                                                                 |
| 5   | Sheet sửa vai trò không vẽ ô "Mô tả"                    | Giữ ô "Mô tả"                                                                        | Bản vẽ lược bớt; bỏ ô là đổi hành vi (không sửa được mô tả)                                                                                                           |
| 6   | Màu tồn kho amber / rose, không ghi ngưỡng              | rose khi ≤ 0, amber khi dưới 10 ống mỗi loại (`stockLevel`), chỉ tô màu, không badge | Khớp số trên bản vẽ (74 và 30 quả amber, 0 và −6 rose). Câu "ngưỡng theo từng loại hay tổng" thuộc A (badge "Sắp hết") nên bỏ qua; banner tổng giữ như cũ             |
| 7   | Đầu tab Loại cầu 1 dòng (vẽ ở 390)                      | Ở 360 px tiêu đề "Quản lý Loại quả cầu" xuống 2 dòng bên trái nút                    | Thay cho nút rơi xuống hàng riêng; tiết kiệm ~28 px                                                                                                                   |
| 8   | Mockup vẽ thanh tab 64 px                               | Không đặt gì theo chiều cao tab                                                      | B không có FAB / thanh dính đáy nào mới; tab 56 px do Layout lo                                                                                                       |
| 9   | Sửa vai trò: bản vẽ chưa nói về focus                   | `initialFocus="panel"` khi sửa (tạo mới vẫn focus ô tên), cả desktop                 | Ô tên quyền bị khóa nên focus rơi vào "Tên hiển thị" và bật bàn phím Android trong khi việc chính là tích quyền; bàn giao đợt 0 ghi "sửa vai trò" là chỗ dùng `panel` |

Desktop 1280 (so điểm ảnh với bản build `91fd4a4`, cùng máy chủ giả, 6 màn chụp cả trang): khác nhau chỉ trong dải
tiêu đề (y 90–117). Dưới dải tiêu đề: 0 điểm ảnh khác, trừ 4 điểm ảnh ở góc bo nhãn quyền màn Người chơi lệch 1/255
kênh đỏ (chụp lại bản nhánh hai lần đều ra 4 điểm này; mắt không thấy).

## 3. Chữ phát sinh

Ngoài danh sách đã gật (nhãn nhóm quyền dùng lại tên menu):

| Chữ                                          | Ở đâu                                          | Ghi chú                                                                                                        |
| -------------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `aria-label` "Xóa {tên người chơi}"          | nút thùng rác trên thẻ người chơi (điện thoại) | B ghi "Xóa thành nút biểu tượng" nhưng chưa có nhãn; thêm tên để 25 nút không trùng tên với trình đọc màn hình |
| `aria-label` "Thao tác khác: {tên loại cầu}" | nút ⋯ trên thẻ loại cầu                        | Dùng lại "Thao tác khác" của nút ⋯ đợt 0, thêm tên loại cầu                                                    |

Chữ cũ dùng ở chỗ mới: tiêu đề sheet ⋯ = tên loại cầu; mục sheet "Lịch sử", "Lên giá", "Sửa", "Xóa" (chữ nút cũ);
nhóm quyền lạ (backend thêm sau) giữ mã, viết hoa chữ đầu như trước.

## 4. Quyết định tự chọn

- Không đổi `alert()` / `confirm()`: B không gồm việc này (bảng "Thay đổi" xếp "Phản hồi" vào A). Còn 23 `alert()` và
  5 `confirm()` trong 6 file của nhóm; nút thùng rác trên thẻ người chơi và mục "Xóa" trong sheet ⋯ vẫn gọi `confirm()`
  cũ. Việc để sau.
- Không đổi thẻ Mức tính, Menu nước, TK nhận tiền và danh sách vai trò: B chỉ gồm Người chơi, Loại cầu, Sửa vai trò,
  tab Master, màu ô tích. Riêng đầu tab TK nhận tiền sửa chỗ nút rơi xuống hàng riêng (chỗ "khoảng trống thừa" PM nhờ kiểm).
- Sheet ⋯ tách file `ShuttleActionsSheet.jsx` (ShuttlesManagement.jsx đã 720 dòng); hằng số ống / ngưỡng chuyển sang
  `utils/shuttleStock.js` để banner tổng và màu từng loại dùng chung một ngưỡng.
- Bấm mục "Xóa" trong sheet ⋯: hộp `confirm()` hiện khi sheet chưa kịp đóng (đóng ngay sau khi trả lời). Hết khi đổi
  sang `ConfirmDialog`.

## 5. API cho nhóm khác dùng lại

```js
import {
  PERMISSION_GROUPS,
  permissionGroupLabel,
  groupPermissions,
} from "../../utils/permissionGroups";
groupPermissions(flatPermissions); // [{ key: "bills", label: "Bill cầu", permissions: [...] }, …] theo thứ tự menu

import {
  BALLS_PER_TUBE,
  LOW_STOCK_TUBES,
  LOW_STOCK_BALLS,
  stockLevel,
} from "../../utils/shuttleStock";
stockLevel(-6); // "out" · stockLevel(96) → "low" · stockLevel(214) → "ok"
```

## 6. Kiểm chứng (trong `FRONTEND`, 05/11/2026)

| Cổng                               | Kết quả                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `npm test`                         | 10 file, **105 passed**, 0 failed (trước: 8 file, 94) — thêm `permissionGroups` (6), `shuttleStock` (5)   |
| `npx eslint .`                     | **3 lỗi + 8 cảnh báo**, bằng mốc `91fd4a4` (cùng file; cảnh báo `PlayersManagement.jsx` useEffect có sẵn) |
| `VITE_API_URL=/api npx vite build` | ok (cảnh báo chunk > 500 kB có sẵn), dùng `tools/vite.no-repo-write.config.mjs`                           |
| `git diff --stat 91fd4a4`          | 10 file, chỉ file của nhóm 06; sửa bằng script nên không file nào bị format lại cả file                   |

Ảnh (máy chủ giả `tools/mock-server.mjs`, cổng 4106, không chạm máy chủ thật), thư mục
`/private/tmp/claude-501/-Users-admin-Desktop-Github-APACTech-BadmintonNew/0c1bebe2-0704-4215-bcf9-7308f4798c3d/scratchpad/trien-khai/06-quan-ly/anh/`:

- `viec/` — ba việc ở 360 / 390 / 430: thêm nhanh 3 người (`admin-players-*-them-nhanh-*`), nhập kho 10 ống
  (`admin-master-tab-shuttles-*-nhap-kho*`, sheet ⋯ `*-sheet-thao-tac`, lịch sử `*-lich-su`), bật quyền
  (`admin-roles-*-sua-vai-tro*`); dữ liệu khó của Người chơi: nợ 12.450.000 ₫ (`*-no-lon`), nợ lẻ 92.857 ₫ (`*-no-le`),
  tên 30 ký tự (`*-ten-dai`), gán quyền ô tích emerald (`*-gan-quyen`), không tìm thấy khi lọc (`*-khong-tim-thay`).
- `master-tab/` — 4 tab Master ở 360 / 390 / 430 / 1280.
- `man/` — 6 màn ở 360 / 390 / 430 / 1280.
- `kho-thap/` — tổng tồn dưới 10 ống (banner) ở 360 / 390 / 430 / 1280; loại cầu tên 39 ký tự, tồn 0 và −6.
- `chi-xem/` — tài khoản chỉ có quyền xem (như "Sắp lịch thi đấu"): Loại cầu không có nút, Người chơi.
- `rong/` — dataset rỗng: 6 màn ở 390.
- `desktop/` — sheet sửa vai trò ở 1280 (khung cũ, nhãn tiếng Việt).
- `o-tich/` — ô tích emerald trong sheet sửa Mức tính ("Mặc định cho giới tính") và TK nhận tiền ("Đang sử dụng").

Fixture riêng: `06-quan-ly/fx-06.mjs` (tên dài, nợ lớn / lẻ, `FX_LOW=1` tồn thấp, `FX_VIEWER=1` tài khoản chỉ xem).

Chưa kiểm được (cần máy thật): bàn phím Android khi mở sheet sửa vai trò (`initialFocus="panel"`).

## 7. Thấy khi làm, ngoài phạm vi (không sửa)

- `ShuttlesManagement.jsx:25` `todayInputDate()` dùng `toISOString()` (UTC): 0h–7h giờ VN ngày mặc định của Nhập kho /
  Lên giá là hôm qua. Giả thuyết — đọc code, chưa chạy thử.
- `ShuttlesManagement.jsx:430`, `:531` in ngày thô ở sheet Lên giá / Lịch sử nhập kho (đợt 0 đã ghi); bảng lịch sử vẫn
  cuộn ngang ở 360–430 (B không giải quyết).
- `PlayersManagement.jsx:43-46` gõ ô tìm gọi API ở mỗi phím và tải lại danh sách vai trò mỗi lần.
- Người chơi, Mức tính, Menu nước, TK nhận tiền, Quyền không kiểm `*.create / update / delete` trên nút; 4 tab Master
  không lọc theo quyền (`MasterManagement.jsx:8-13`). Tài khoản chỉ xem vẫn thấy nút Sửa / Quyền / Xóa ở Người chơi
  (ảnh `chi-xem/`). Giữ như cũ.
- `MasterManagement.jsx:33` `aria-label` của dải tab vẫn là "Quản lý Master" (không thấy trên màn; đổi là chữ mới).
- Thẻ TK nhận tiền vẫn cao ~430 px vì ảnh QR (phương án A mới thu nhỏ QR).
- `RatiosManagement.jsx:43` sheet sửa mức tính đặt thẳng `ratio.value` từ API (chuỗi `"1.000"`, 3 chữ số thập phân) nên ô
  "Giá trị" hiện "1.000", đọc kiểu Việt Nam như một nghìn (ảnh `o-tich/`). Ô chọn ảnh QR vẫn ghi "Choose file" (A mới đổi).
