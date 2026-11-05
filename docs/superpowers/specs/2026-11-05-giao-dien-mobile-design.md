# Thiết kế: giao diện điện thoại toàn app (bố cục và luồng thao tác)

Ngày: 2026-11-05
Trạng thái: chủ dự án duyệt hướng và các quyết định ở mục 2 (05/11/2026); triển khai trên nhánh tích hợp
`feature/giao-dien-mobile` (worktree `../BadmintonNew-wt-mobile`), merge `main` khi chủ dự án duyệt ảnh chụp.
Phạm vi: chỉ `FRONTEND/`, không đụng backend.

Bản đề xuất (bước 1) nằm cạnh file này trong `2026-11-05-giao-dien-mobile/`: `tong-hop.html` (PM tổng hợp) và
`0N-<nhóm>-de-xuat.html` (7 nhóm). Ảnh chụp kèm đề xuất không chép vào repo, nên một số ảnh "màn hiện tại" trong các
file HTML sẽ không hiện; mockup thì vẽ bằng HTML nên vẫn xem được.

## 1. Mục tiêu

Đợt 21–22/10/2026 đã đồng bộ **phong cách** (`2026-10-21-giao-dien-moi-design.md`). Đợt này làm lại **bố cục và luồng
thao tác trên điện thoại**: thứ bậc thông tin, mật độ, nút chính trong tầm ngón cái, số lần chạm, phản hồi sau thao tác,
trạng thái rỗng / đang tải / lỗi. Desktop giữ bố cục (thay đổi đặt dưới `sm`/`md`), trừ chỗ ghi rõ ở mục 2.

Giữ nguyên: hệ thống thiết kế (Inter, `slate-50`, `emerald-700`, `.btn*`, `.field-*`, `.card`, `.badge*`,
`.tab-list`, `icons.jsx`), route, quyền, API, cách tính tiền; không thêm phụ thuộc npm; không chế độ tối.
**Ảnh bill xuất** (`BillExport.jsx`, `BillContent.jsx` trong export, `PartyBillExport.jsx`) giống `main` từng điểm ảnh.

## 2. Quyết định của chủ dự án (05/11/2026)

| #   | Quyết định                                                                                                                                                                                                                   |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Phương án **A** cho 01 Khung app, 02 Danh sách bill cầu, 03 Tạo / sửa bill cầu, 04 Chi tiết bill cầu, 05 Bill tiệc (**không** làm A+ "Lấy người từ bill cầu" đợt này). Phương án **B** cho 06 Quản lý, 07 Thuê xe + Xếp bảng |
| 2   | Gộp thanh trên: bỏ tầng "Sổ cầu lông" riêng trên điện thoại; màn gốc hiện tiêu đề trang trên thanh, màn đẩy vào dùng thanh M1 (‹ + tiêu đề + ⋯)                                                                              |
| 3   | Ẩn thanh tab dưới đáy ở màn chi tiết bill cầu `/bills/:id` và bill tiệc `/party-bills/:id` (như màn tạo / sửa)                                                                                                               |
| 4   | Tiêu đề màn gốc dùng đúng nhãn tab, cả desktop: "Bill cầu", "Bill tiệc", "Người chơi", "Xếp bảng", "Thuê xe", "Master", "Quyền"                                                                                              |
| 5   | Màn đăng nhập: phương án A (dải sân cầu lông + tên app, giữ chữ cũ)                                                                                                                                                          |
| 6   | Thanh tab giữ 56 px; mọi vị trí (FAB, M2, thông báo) tính theo biến `--tab-bar-h`                                                                                                                                            |
| 7   | "Đã trả hết" (đánh dấu mọi bill của một người) phải qua `ConfirmDialog` — Dashboard và Bill tiệc                                                                                                                             |
| 8   | **Giữ như cũ**: bấm "Đã TT" thì hàng người đó nhảy xuống cuối (nhóm đã trả). KHÔNG làm "hàng đứng yên" như đề xuất 04 / 05. Vẫn có trạng thái đang lưu trên nút                                                              |
| 9   | Hiện nợ cũ trên màn chi tiết bill tiệc (hiện chỉ có trong ảnh xuất)                                                                                                                                                          |
| 10  | Ẩn nút theo quyền ở màn chi tiết: Xóa cần `bills.delete` / `party_bills.delete`, Đã TT cần quyền đánh dấu tương ứng — kiểm tên quyền thật trong code                                                                         |
| 11  | Trên điện thoại, "Xuất Bill" mở bảng chia sẻ của máy (`navigator.share` với file); máy không hỗ trợ thì tải file như cũ                                                                                                      |
| 12  | Bỏ qua bước chọn tài khoản nhận tiền khi chỉ có đúng 1 tài khoản đang bật (bill cầu và bill tiệc)                                                                                                                            |
| 13  | Thống kê không phụ thuộc bộ lọc ngày của danh sách                                                                                                                                                                           |
| 14  | Bỏ ô "Số bill / trang" trên điện thoại, thay bằng "Xem thêm" (desktop giữ phân trang)                                                                                                                                        |
| 15  | Ảnh "Xuất bảng" thi đấu đổi sang khung 720 px, 2 cột (cả desktop) — làm kèm phương án B của nhóm 07                                                                                                                          |

Chữ mới: dùng đúng danh sách "Chữ mới chờ chủ dự án gật" trong đề xuất của phương án được chọn; chủ dự án duyệt hướng
ngày 05/11/2026 và có thể sửa chữ khi xem ảnh chụp. Chữ phát sinh ngoài danh sách phải ghi trong báo cáo triển khai.

### 2.1 Câu hỏi riêng từng nhóm — PM chốt mặc định (chủ dự án đổi được khi duyệt ảnh)

Nguyên tắc: thay đổi chỉ về giao diện thì làm theo đề xuất; thay đổi hành vi hoặc dữ liệu mà chủ dự án chưa nói thì
**giữ như cũ**.

- **02**: bill con còn nợ dưới bill chính đã trả **có hiện** (chỉ là hiện thêm thông tin).
- **03**: bill con giữ cách điền sẵn như hiện nay; màn Sửa có dải cảnh báo người đã TT sẽ về "Chưa TT" (đúng hành vi
  backend hiện tại, lỗi backend tách việc riêng); đổi nhãn "Unit price" → "Tiền cho mức 1"; **không** sửa ngày mặc
  định UTC trong đợt này (lỗi ngoài phạm vi, mục 7).
- **03 (chủ dự án chốt 05/11/2026)**: màn Tạo / Sửa bill, số tiền trên hàng người chơi **không** gồm nợ cũ / nợ ghi
  tay — giữ như cũ; máy chủ cộng nợ khi lưu (`CreateBill.jsx:182`, `BillController.php:121, :182`).
- **04**: giữ STT trên hàng người chơi ở điện thoại (khớp cột TT của ảnh xuất).
- **05**: bỏ chữ "Mức: x" trong sheet chọn người bill tiệc (không đổi cách tính); STT trên màn giữ như hiện nay.
- **06 (B)**, **07 (B)**: đúng phạm vi phương án B trong đề xuất của nhóm; câu hỏi chỉ thuộc phương án A thì bỏ qua.
  07: số "/người" giữ cách in hiện nay, không thêm "level TB", không thêm tab "Dán chữ", không sửa thuật toán chia bảng.

## 3. Bộ mẫu dùng chung (sau rà chéo)

Chi tiết kích thước: `01-khung-app-de-xuat.html` mục 5 và 16.

| Mã  | Mẫu                           | Chốt                                                                                                                                               |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| M1  | Thanh đầu màn đẩy vào         | ‹ 44 px + tiêu đề 1 dòng + ⋯ (sheet hành động phụ); thay thanh app; không có ⋯ khi không có hành động phụ                                          |
| M2  | Thanh hành động dính đáy      | 1 nút chính + tối đa 1 nút phụ, có thể kèm tổng tiền bấm được (mở sheet tóm tắt); màn đẩy vào: tab ẩn; màn gốc (Thuê xe): đứng trên tab            |
| M3  | Hàng danh sách                | cả hàng bấm được, không nút Xóa trên hàng, cao 60–76 px                                                                                            |
| M3b | Hàng có nút đuôi              | nút có chữ ≥ 84×44 ("Đã TT", "Nhập kho"), không bao giờ là Xóa, không lồng nút trong nút — bill cầu và bill tiệc dùng **cùng kiểu** (kiểu nhóm 04) |
| M3c | Hàng mở tại chỗ               | `aria-expanded`, mỗi lúc một hàng mở                                                                                                               |
| M4  | Chip lọc + "Lọc"              | nút "Lọc" (có số đếm) **ghim trái**, chip cuộn ngang; ≤ 4 lựa chọn một-chọn thì chỉ chip; chip bật có ✓                                            |
| M5  | Bottom sheet                  | `Modal`; biến thể chọn nhiều (cao cố định, không tự focus, chân "Xong · N"); sheet sửa có Xóa ở đầu chân                                           |
| M6  | Ngày                          | `formatDateShort`: "T4, 04/11"; khác năm "04/11/2025"                                                                                              |
| M7  | Số tiền                       | qua `formatters.js`, số chính 20 px đậm                                                                                                            |
| M8  | Thông báo ngắn                | `useToast`; trên tab / FAB / M2; thành công 4 s, lỗi 7 s + "Thử lại"; không "Hoàn tác"                                                             |
| M9  | FAB                           | đáy = `--tab-bar-h` + safe area + 16 px                                                                                                            |
| M10 | Đầu nhóm dính                 | `.group-head`                                                                                                                                      |
| M11 | Ô tóm tắt bấm được            | `.stat-tile`                                                                                                                                       |
| M12 | Chọn kỳ ‹ ›                   | `ui/PeriodStepper.jsx` (nhóm 02 viết)                                                                                                              |
| M13 | Lỗi tải / rỗng / rỗng sau lọc | `EmptyState` thêm `tone="error"`, `compact`                                                                                                        |
| M14 | Lỗi ngay tại ô                | `.field-error`, `aria-invalid`                                                                                                                     |
| M15 | Hàng menu trong sheet         | `.menu-row`                                                                                                                                        |
| M16 | Chọn nhanh 2–3 lựa chọn       | kiểu `.tab-list` trong form, `role="radiogroup"`                                                                                                   |
| M17 | Ô số −/+ và bôi đen khi chạm  | tùy chọn của `NumberInput` / `CurrencyInput`                                                                                                       |

## 4. Chia đợt và quyền sở hữu file

| Đợt | Nhóm                   | Nhánh / worktree                                         | Sở hữu                                                                                                                                                                                                                                                                                                                  |
| --- | ---------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | 01 Khung app + nền (A) | `feature/giao-dien-mobile` / `../BadmintonNew-wt-mobile` | `Layout.jsx`, `NavDropdown.jsx`, `App.jsx`, `ProtectedRoute.jsx`, `components/ui/*` (trừ `PeriodStepper`), `components/common/{ConfirmDialog,CurrencyInput,ThousandHint,NumberInput,DatePicker}`, `index.css`, `index.html`, `tailwind.config.js`, `utils/formatters.js`, `utils/navItems.js`, `screens/auth/Login.jsx` |
| 1   | 02 (A)                 | `feature/mobile-02-danh-sach`                            | `screens/dashboard/*`, `components/dashboard/*`, `ui/ColumnChart.jsx`, `ui/PeriodStepper.jsx` (mới), `utils/monthlyStats.js`                                                                                                                                                                                            |
| 1   | 03 (A)                 | `feature/mobile-03-tao-sua`                              | `screens/bills/CreateBill.jsx`, `EditBill.jsx`, `components/bill/{PlayerSelector,PlayerBillCard,QuickAddMenu,MenuItemPicker,ShuttleRow,BillSummary,PlayerPickerSheet}`                                                                                                                                                  |
| 1   | 04 (A)                 | `feature/mobile-04-chi-tiet`                             | `screens/bills/BillDetail.jsx`, `components/bill/BillContent.jsx` (phần màn hình), `common/PayOldBillsDialog`, `common/SelectPaymentAccountDialog`, `utils/billTotals.js`                                                                                                                                               |
| 1   | 06 (B)                 | `feature/mobile-06-quan-ly`                              | `screens/{players,master,ratios,menus,shuttles,payment-accounts,roles}/*`                                                                                                                                                                                                                                               |
| 1   | 07 (B + ảnh xuất bảng) | `feature/mobile-07-tien-ich`                             | `screens/car-rental/*`, `components/car-rental/*`, `screens/tournament/*`                                                                                                                                                                                                                                               |
| 2   | 05 (A)                 | `feature/mobile-05-bill-tiec`                            | `screens/party/*` (dùng lại `PlayerPickerSheet` của 03, hai hộp thoại và M3b của 04)                                                                                                                                                                                                                                    |

- Đợt 1 tách từ commit cuối của đợt 0; đợt 2 tách sau khi 03 và 04 đã merge vào nhánh tích hợp. PM merge từng nhánh vào
  `feature/giao-dien-mobile`, chạy lại cổng kiểm.
- Không sửa file của nhóm khác. Thiếu class / component chung thì dùng Tailwind tại chỗ và ghi đề xuất vào báo cáo.
  Ngoại lệ: được **thêm** biểu tượng vào cuối `components/ui/icons.jsx` trong commit riêng (PM gộp khi merge).
- File mới đặt tên theo chức năng, cạnh file cùng loại; hàm thuần ở `src/utils/*.js` kèm `*.test.js`.
- Mỗi nhóm ghi phần "triển khai" của mình (chỗ chệch bản vẽ + lý do, chữ phát sinh, quyết định tự chọn) vào
  `2026-11-05-giao-dien-mobile/<nhóm>-trien-khai.md` — không sửa file spec này (tránh xung đột khi merge).

## 5. Cổng kiểm mỗi nhánh (trong `FRONTEND`)

1. `npm test` — 0 failed.
2. `npx eslint .` — không thêm lỗi / cảnh báo so với mốc chạy trên `main` (mốc 22/10/2026: 3 lỗi + 8 cảnh báo; đo lại).
3. `VITE_API_URL=/api npx vite build --outDir <scratchpad>/…` — ok.
4. `git diff --stat` so với điểm tách — mỗi file chỉ đổi chỗ cần đổi, không format lại cả file.
5. Ảnh chụp qua **máy chủ giả** (không bao giờ qua máy chủ thật) ở 360 / 390 / 430 (`isMobile`, `hasTouch`,
   `deviceScaleFactor: 2`) và 1280, kèm dữ liệu khó (tên ~30 ký tự, bill 25 người, tiền hàng chục triệu, tiền lẻ làm
   tròn nghìn, danh sách rỗng, người còn nợ bill cũ, tài khoản đủ 7 mục và tài khoản 2 mục).
6. Nhóm có ảnh bill xuất (04, 05): xuất ảnh bill cầu có bill con và bill tiệc, so với bản build `main` cùng dữ liệu —
   0 điểm ảnh khác.

## 6. Không làm

- Không sửa backend, không thêm API, không migration; không deploy; không merge `main` khi chủ dự án chưa duyệt ảnh.
- Không làm A+ bill tiệc; không chuyển `alert()` ở màn nào mà phương án được chọn không gồm việc đó.

## 7. Lỗi có sẵn ngoài phạm vi (ghi lại, không sửa trong đợt này)

Danh sách đầy đủ ở `tong-hop.html` mục 6. Hai lỗi nghiêm trọng, PM đã đọc code xác nhận:

- Backend không kiểm quyền: route chỉ `auth` (`routes/api.php:27`), 26 `FormRequest::authorize()` đều `return true`
  (`StoreRoleRequest.php:14` ghi TODO), không Gate / Policy. Ẩn nút theo quyền (quyết định 10) chỉ là giao diện.
- Sửa bill cầu tạo lại `bill_players` với `is_paid = false` (`Api/BillController.php` ~440–486) nên mất dấu "Đã TT".
