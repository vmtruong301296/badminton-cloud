# 07 Thuê xe + Xếp bảng — triển khai (đợt 1, phương án B + ảnh xuất bảng 720 px)

Ngày: 2026-11-05 · Nhánh `feature/mobile-07-tien-ich` (tách từ `91fd4a4`) · Spec: `../2026-11-05-giao-dien-mobile-design.md` ·
Đề xuất: `07-thue-xe-xep-bang-de-xuat.html`, mục "Phương án B · nhẹ hơn" + T8 (ảnh xuất, quyết định 15) ·
Chủ dự án duyệt hướng 05/11/2026.

Chỉ frontend. Không đổi route, quyền, API, cách tính tiền, thuật toán chia bảng. Desktop giữ bố cục, trừ ảnh
"Xuất bảng" (quyết định 15) và tiêu đề màn (quyết định 4).

## 1. Đã làm

**Thuê xe** (`screens/car-rental/*`, `components/car-rental/*`)

- Tiêu đề "Thuê xe" (cả desktop).
- Thanh dính đáy viết cứng (`bottom-[calc(4rem+…)]`, lộ khe 8 px) → `ActionBar overTab`: trái "Rẻ nhất: {tên}" +
  tổng xe của phương án rẻ nhất (cập nhật khi gõ), phải "Lưu lại" / "Cập nhật" (đang lưu: vòng quay + "Đang lưu...").
  Không có quyền lưu: phải là "Copy kết quả". Có quyền lưu thì "Copy kết quả" nằm cạnh "Nhập lại" ở cuối khối Kết quả.
- Khung thông báo ở đỉnh trang → toast M8: "Đã copy kết quả.", lỗi copy, lỗi lưu (7 s + "Thử lại", lưu theo số đang
  có trên form lúc bấm), "Đã lưu vào Lịch sử" (sau khi lưu, màn tự sang tab Lịch sử như cũ).
- "Nhập lại" (điện thoại và desktop) hỏi trước bằng `ConfirmDialog` "Nhập lại từ đầu?".
- Lịch sử trên điện thoại: hàng M3 (tên tối đa 2 dòng, "T7, 21/11 · 3 ngày · 1.240 km", "Rẻ nhất: …", tổng xe, nhãn
  "Bill tiệc" khi có gắn) → chạm mở sheet chi tiết (nội dung cũ của phần mở rộng) với "Xóa" + "Nạp vào máy tính"
  (theo quyền `.delete` / `.update` như cũ). Desktop giữ thẻ mở rộng tại chỗ. Xóa qua `ConfirmDialog`
  "Xóa lần so sánh" thay `window.confirm`; lỗi xóa: trong sheet (điện thoại) / toast (desktop).
  Rỗng: thêm nút "Tính chuyến mới" (về tab Tính toán).

**Xếp bảng** (`screens/tournament/*`, mới: `components/tournament/BracketsExport.jsx`, `utils/tournamentBrackets.js`)

- Tiêu đề "Xếp bảng" (cả desktop).
- VĐV trên điện thoại (dưới `md`, như thẻ cũ): hàng M3 — STT, tên (tối đa 2 dòng), "Nam · Level 2", nhãn "Bảng n"
  (tên bảng từ API, `player.brackets[0].name`) hoặc "Chưa xếp"; nền xanh / hồng nam nữ giữ như cũ. Chạm hàng → sheet
  VĐV (giới tính · level, nhãn bảng, nút "Xóa"; VĐV đã xếp bảng thì nút mờ như cũ).
- Hộp "Thêm VĐV" không đóng sau mỗi người: xóa ô Họ Tên, giữ giới tính + level, con trỏ về Họ Tên (Enter = Thêm;
  nút "Thêm" không lấy focus nên bàn phím không sập), dòng "Vừa thêm: {tên}"; "Hủy" → "Xong". Lỗi (vd trùng tên,
  câu của backend) hiện ngay trong sheet, tên đang gõ giữ nguyên.
- Bảng thi đấu trên điện thoại: vẫn 1 cột, hàng gọn (tên trái, "Nam · Level 2" phải, nam trước nữ). "Xóa tất cả" vào
  ⋯ "Thao tác khác" trên thanh trên (`PageHeader menu`, chỉ khi tab Bảng, có bảng và có quyền `.delete`).
  "Xuất bảng" ở `ActionBar overTab`. "Xếp bảng" giữ nút ở đầu tab như cũ.
- `prompt()` tạo danh sách → sheet "Tạo danh sách VĐV" (nhãn "Tên danh sách"). `confirm()` → `ConfirmDialog`
  ("Xóa VĐV", "Xóa tất cả bảng thi đấu", câu hỏi giữ chữ cũ). `alert()` → toast (kết quả thao tác, chữ cũ) / khối lỗi
  trong sheet (khi sheet đang mở) / `EmptyState tone="error"` + "Thử lại" (lỗi tải trang, chữ cũ).
- Ảnh "Xuất bảng" (quyết định 15, mọi bề ngang): khung ẩn rộng cố định 720 px, 2 cột; đầu ảnh: biểu tượng app,
  tên danh sách, "Bảng thi đấu · {ngày xuất}", góc phải "{n} VĐV · {m} bảng" + kiểu phân bổ; mỗi bảng: tên, số VĐV,
  hàng tên · giới tính · "Level n" (tên dài xuống dòng, không cắt); chân "Sổ cầu lông". Ảnh 1440 px (×2), giống
  nhau từng điểm ảnh dù bấm từ 360, 390 hay 1280.

## 2. Chỗ chệch bản vẽ và lý do

| #   | Bản vẽ / đề xuất                                                                                  | Triển khai                                                                              | Lý do                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | B1 / X1: phần tổng bên trái thanh đáy có `^`, chạm → cuộn tới Kết quả                             | Phần tổng chỉ để xem, không bấm được                                                    | `ActionBar` gắn cứng `aria-haspopup="dialog"` + `^` cho tổng bấm được, trong khi chạm ở đây là cuộn chứ không mở sheet → trình đọc màn hình báo sai. Đề xuất cho PM ở mục 4 |
| 2   | Thanh đáy cao theo mockup 64 px trên tab 64 px                                                    | Đứng trên tab 56 px (`--tab-bar-h`), thanh 68 px (`--action-bar-h`)                     | Quyết định 6 / tổng hợp 3                                                                                                                                                   |
| 3   | B2: nút ⋯ nằm trong nội dung, phải, trên các bảng                                                 | ⋯ trên thanh trên (`PageHeader menu`, tiêu đề sheet "Thao tác khác")                    | Dùng API M1 có sẵn của đợt 0 thay vì tự dựng nút + sheet riêng; chỉ hiện ở tab Bảng                                                                                         |
| 4   | B2 không vẽ nút "Xếp bảng"                                                                        | Giữ nút "Xếp bảng" ở đầu tab (mờ khi không còn VĐV chưa xếp / không có quyền, như cũ)   | B chỉ chuyển "Xóa tất cả"; đưa "Xếp bảng" vào ⋯ / thanh đáy là phần của A (T7, T9b)                                                                                         |
| 5   | T8: "Vẫn dùng html2canvas đang có"                                                                | Chụp bằng `nodeToPng` (`utils/exportImage.js`, html-to-image — đang dùng cho ảnh bill)  | html2canvas vẽ mọi dòng chữ lệch xuống vài px (tên chạm đường kẻ hàng, tiêu đề đè dòng ngày) — đã chụp kiểm. Không thêm thư viện                                            |
| 6   | T8: điện thoại có Web Share thì mở bảng chia sẻ                                                   | Vẫn tải file như cũ                                                                     | PM chỉ giao khung 720 px, 2 cột, tên danh sách + ngày; Web Share (quyết định 11) mới áp cho "Xuất Bill"                                                                     |
| 7   | Ảnh xuất mockup có thẻ rỗng "Chưa có VĐV" (T6b, phần A)                                           | Bảng 0 VĐV chỉ có tên + "0 VĐV"                                                         | Chữ "Chưa có VĐV" thuộc A, không có trong danh sách B / T8                                                                                                                  |
| 8   | B3 / T4: sheet VĐV có nhãn "Giới tính / Level / Bảng" và nút "Xóa VĐV" + lý do khi không xóa được | Sheet: dòng "Nữ · Level 2" + nhãn bảng, nút "Xóa" (chữ cũ), mờ không kèm lý do (như cũ) | Các nhãn đó và câu lý do là chữ của A, không có (B)                                                                                                                         |
| 9   | M3 hàng 60 px (T1)                                                                                | 64 px (`.list-row` mặc định của đợt 0)                                                  | Dùng class chung; vẫn trong khoảng 60–76 của M3                                                                                                                             |
| 10  | Desktop: thông báo copy / lưu ở đỉnh trang Thuê xe                                                | Toast giữa đáy (cả desktop)                                                             | M8 dùng chung cho mọi bề ngang (đợt 0); không còn khung thông báo riêng                                                                                                     |

## 3. Chữ phát sinh ngoài danh sách (B) đã duyệt

| Chữ                       | Ở đâu                                 | Ghi chú                                                                                                            |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| "Tên danh sách"           | Nhãn ô trong sheet tạo danh sách      | Có trong danh sách chữ mới của A; cần vì PM giao đổi `prompt()` sang `Modal`                                       |
| "Đã tải ảnh bảng thi đấu" | Toast sau khi xuất ảnh                | Có trong danh sách của A (dòng "Xếp bảng · toast"); làm kèm ảnh xuất (quyết định 15) — hôm nay tải về không báo gì |
| "Bill tiệc" (nhãn)        | Hàng Lịch sử thuê xe có gắn bill tiệc | Chữ cũ (nhãn tab) đặt ở chỗ mới, theo hàng M3 của X5                                                               |

Chữ cũ dùng lại ở chỗ mới: "Rẻ nhất: {tên}" trên thanh đáy (B), "Copy kết quả", "Nhập lại" (nút xác nhận),
"Không ghi ngày", "Đã xếp bảng" (nhãn dự phòng khi API không trả tên bảng), "Xóa", "Tạo danh sách VĐV" (tiêu đề + nút
sheet), các câu alert / confirm cũ (nay trong toast, khối lỗi, `ConfirmDialog`, `EmptyState`), câu backend
"Đã xếp … VĐV vào … bảng". Chữ ảnh xuất ("Bảng thi đấu · {ngày}", "{n} VĐV · {m} bảng", "Chia đều giới tính"…,
"Sổ cầu lông") theo dòng "Ảnh xuất bảng" của danh sách chữ mới.

## 4. Quyết định tự chọn, API, đề xuất cho PM

- **File mới**: `components/car-rental/CarRentalHistoryDetail.jsx` (nội dung chi tiết dùng chung cho thẻ desktop và
  sheet điện thoại), `components/tournament/BracketsExport.jsx` (khung ảnh, cùng kiểu `components/bill/BillExport.jsx`),
  `utils/tournamentBrackets.js` + test (thứ tự bảng, thứ tự VĐV nam trước nữ, tóm tắt ảnh xuất, tên bảng của VĐV,
  `GENDER_DISTRIBUTION_LABELS` dùng cả cho ô chọn phân bổ). Thư mục `components/tournament/` mới — chỉ nhóm 07 dùng.
- Xếp bảng / xóa tất cả xong thì tải lại **cả danh sách VĐV** (trước chỉ tải lại bảng): nhãn "Bảng n" / "Chưa xếp",
  ô số và nút "Xếp bảng" đúng ngay, không phải tải lại trang.
- Lỗi khi sheet đang mở hiện trong sheet (khối rose `role="alert"`, theo ghi chú M8 của đợt 0); lỗi tải trang dùng
  `EmptyState tone="error"` (M13), "Thử lại" tải lại danh sách + VĐV + bảng.
- Khung ảnh xuất dựng sẵn ngoài màn hình (`position: fixed; left: -10000px`) khi có bảng — giống `BillDetail`.
- **Đề xuất cho PM (không sửa, file của đợt 0)**:
  - `ActionBar`: thêm cách cho phần tổng bấm được mà không phải mở sheet (vd prop `summary.haspopup = false` và
    biểu tượng tùy chọn) — khi có, 07 bật lại "chạm → cuộn tới Kết quả" của X1.
  - Khối lỗi trong sheet (rose, `CircleAlert`, `role="alert"`) đang được 07 tự dựng (`SheetError` trong
    `TournamentBrackets.jsx`, khối tương tự trong `CarRentalHistory.jsx`); các nhóm khác cũng cần → nên thành class
    / component chung (vd `.sheet-error`).

## 5. Số lần chạm (việc chính)

| Việc                                                      | Hiện nay                                                                        | Sau triển khai                                                                                                                                                   |
| --------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| So sánh 2 phương án cho một chuyến rồi lưu                | 11 chạm · 8 ô; cuộn ~2,2 màn mới biết xe nào rẻ; lưu xong không có câu xác nhận | 11 chạm · 8 ô (như B ước tính); 0 cuộn — "Rẻ nhất" luôn trên thanh đáy; toast "Đã lưu vào Lịch sử"                                                               |
| Nhập 16 VĐV (8 nam, 8 nữ, nhập theo nhóm) rồi chia 4 bảng | 68 chạm (mở lại hộp 16 lần, OK alert)                                           | ≈ 36 chạm: mở hộp 1 + Enter ×16 + Xong 1, đổi giới tính 1 lần (+3), đổi level 6 lần (+12), chia bảng 3 (tab, Xếp bảng, Xếp bảng) — trong khoảng 31–63 B ước tính |

## 6. Kiểm chứng (trong `FRONTEND`, 05/11/2026)

| Cổng                                                                                               | Kết quả                                                                                                                                                                                                                                                                                                      |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm test`                                                                                         | 9 file, **104 passed**, 0 failed (trước: 94; thêm 10 test `tournamentBrackets`)                                                                                                                                                                                                                              |
| `npx eslint .`                                                                                     | **3 lỗi + 8 cảnh báo** = mốc `91fd4a4`; cảnh báo duy nhất trong file của 07 là `exhaustive-deps` có sẵn ở `TournamentBrackets.jsx` (dời từ dòng 45 xuống 101)                                                                                                                                                |
| `VITE_API_URL=/api npx vite build --config tools/vite.no-repo-write.config.mjs --outDir <scratch>` | ok (cảnh báo chunk > 500 kB có sẵn)                                                                                                                                                                                                                                                                          |
| `git diff --stat 91fd4a4`                                                                          | 8 file, đều của 07; không file nào bị format lại cả file (file cũ sửa bằng script, giữ nháy đơn / khoảng trắng cuối dòng của `TournamentBrackets.jsx`)                                                                                                                                                       |
| Desktop 1280 so với `91fd4a4`                                                                      | Thuê xe (Tính toán, cả trang + Lịch sử) và Xếp bảng tab Bảng: chỉ khác vùng tiêu đề (32–284 × 90–118 px). Tab VĐV cả trang: thêm các điểm ảnh khử răng cưa trên từng dòng chữ, hình học không đổi (đã cắt so) — giả thuyết: khung ảnh ẩn `position: fixed` tạo lớp ghép làm Chrome đổi cách khử răng cưa chữ |
| Ảnh xuất                                                                                           | 360 / 390 / 1280 cùng dữ liệu: **0 điểm ảnh khác**                                                                                                                                                                                                                                                           |

Ảnh chụp qua máy chủ giả (`tools/mock-server.mjs`, cổng 4107; không chạm máy chủ thật), thư mục
`/private/tmp/claude-501/-Users-admin-Desktop-Github-APACTech-BadmintonNew/0c1bebe2-0704-4215-bcf9-7308f4798c3d/scratchpad/trien-khai/07-thue-xe-xep-bang/anh/`:

- `thue-xe/` — so 2 phương án rồi lưu ở 390: thanh đáy, toast "Đã copy kết quả." và toast lỗi lưu đứng trên ActionBar,
  "Thử lại" → "Đã lưu vào Lịch sử", sheet chi tiết, xác nhận xóa, "Nhập lại từ đầu?".
- `thue-xe-kho/` — 360 / 430: tên phương án rẻ nhất rất dài (cắt "…"), 31.982.240 ₫, chia 30 người (số lẻ).
- `xep-bang/` — tạo danh sách bằng sheet, nhập 16 VĐV liên tục, chia 4 bảng (toast trên ActionBar), ảnh xuất
  `10-anh-xuat-bang-*.png`, ⋯ "Thao tác khác", xác nhận xóa tất cả, hàng "Bảng n", sheet VĐV — 360 / 390 / 1280.
- `xep-bang-loi/` — lỗi tải trang + "Thử lại", lỗi trùng tên trong sheet "Thêm VĐV".
- `man/` — 360 / 390 / 430 / 1280: Thuê xe (Tính toán, Kết quả, Lịch sử), Xếp bảng (VĐV 28 người, Bảng); `rong-*` dữ liệu rỗng.
- `vai-tro/` — chỉ xem (`view-*`: thanh đáy "Copy kết quả", không ⋯), Sắp lịch thi đấu (`scheduler-*`: không ⋯ vì
  không có `.delete`), profile `limited` (không vào được hai màn, như cũ).
- `so-anh-xuat/so-sanh-anh-xuat.png` — ảnh xuất cũ (điện thoại 716 × 3200 một cột, desktop 2432 × 920 bốn cột) so
  với ảnh mới cùng dữ liệu; `cu/` — màn cũ 390 / 1280; `so-desktop/` — desktop cũ / mới cả trang.

Chưa kiểm được (cần máy thật): bàn phím iOS / Android không sập khi bấm "Thêm" liên tục (`onMouseDown`
`preventDefault`), font trong ảnh xuất trên Safari (html-to-image không nhúng được stylesheet Google Fonts khác nguồn —
cùng tình trạng với ảnh bill).

## 7. Thấy khi làm, ngoài phạm vi (không sửa)

- Thuật toán chia bảng chia theo từng nhóm giới tính + level rồi `floor` + dư cho bảng đầu
  (`BACKEND/app/Http/Controllers/Api/BracketController.php:113-138`) → nhóm ít người dồn vào bảng đầu, có bảng 0 VĐV
  (16 VĐV / 4 bảng ra 6 / 6 / 4 / 0 trong ảnh chụp). Việc riêng của backend, như đã chốt.
- Tạo danh sách mới xong, màn vẫn chọn danh sách mặc định (`TournamentBrackets.jsx:111`, `loadPlayerLists` luôn
  chọn mặc định) — giữ như cũ; người dùng phải tự chọn danh sách vừa tạo.
- Import: các dòng bị bỏ qua chỉ ghi `console.warn` (`TournamentBrackets.jsx:275`) — phần A định hiện trong sheet.
- "Hủy sửa" ở Thuê xe xóa trắng form không hỏi (`CarRentalCalculator.jsx:526`).
- `TournamentBrackets.jsx` 1.057 dòng, `CarRentalCalculator.jsx` 1.176 dòng (đều > 400): nên tách các sheet
  (thêm VĐV, import, xếp bảng, tạo danh sách, sheet VĐV) ra `components/tournament/` ở đợt sau.
- html-to-image ghi `console.error` "Failed to read the 'cssRules'…" khi xuất ảnh (stylesheet Google Fonts khác nguồn);
  ảnh vẫn ra đúng. Cùng lỗi với ảnh bill (`utils/exportImage.js`).
- Ô "Chưa xếp bảng" ở thẻ số Xếp bảng xuống 2 dòng ở 360–430 (có sẵn, B không đổi khối này).
