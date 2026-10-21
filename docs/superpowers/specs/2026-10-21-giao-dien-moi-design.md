# Thiết kế: làm mới giao diện toàn app theo phong cách web app hiện đại

Ngày: 2026-10-21
Trạng thái: chủ dự án giao "làm luôn" (21/10/2026), triển khai trên nhánh `feature/giao-dien-moi`; duyệt bằng ảnh chụp trước khi merge
Phạm vi: chỉ `FRONTEND/`, không đụng backend

## 1. Mục tiêu

Đưa toàn bộ Sổ cầu lông về **một** giao diện thống nhất, gọn và sáng sủa
như các web app phổ biến hiện nay (kiểu Linear, Vercel, Stripe Dashboard,
shadcn/ui): nền trung tính, thẻ trắng viền mảnh, một màu thương hiệu, biểu
tượng nét thay cho emoji, điều hướng dưới đáy màn hình trên điện thoại.

Dữ liệu, luồng thao tác, route, quyền, chữ hiện có và **ảnh bill xuất ra**
giữ nguyên.

## 2. Vì sao

App đang có ba kiểu giao diện cùng lúc:

| Nhóm | File | Kiểu hiện tại |
|---|---|---|
| Bill cầu, bill tiệc | `screens/bills/*`, `screens/party/*`, `screens/dashboard/*` | mới nhất: Fraunces, `bone-*`, `shadow-card`, `rounded-2xl`, FAB xanh ngọc |
| Khung trang + màn quản lý | `components/Layout.jsx`, `NavDropdown.jsx`, `screens/players`, `ratios`, `menus`, `shuttles`, `payment-accounts`, `roles`, `tournament`, `master` | Tailwind mặc định cũ: `gray-*`, `rounded-md`, menu emoji, nút `bg-green-600` / `bg-blue-600` lẫn lộn, `<label>` không gắn ô |
| Đăng nhập | `screens/auth/Login.jsx` | nền gradient + đốm mờ + nút gradient: **trông như form mẫu**, đúng kiểu khiến tên miền bị Google Safe Browsing gắn cờ "lừa đảo" (16/10/2026) |

## 3. Không làm (non-goals)

- Không đổi logic, API, route, quyền, cách tính tiền; không thêm tính năng.
- Không thêm phụ thuộc npm (không thư viện UI, không thư viện icon).
- Không thêm chế độ tối, không thêm chỉnh cỡ chữ.
- Không thay `alert()` / `confirm()` bằng toast trong đợt này (≈ 100 chỗ,
  đổi hành vi). Ghi vào báo cáo như việc tiếp theo.
- Không đổi nội dung bên trong `#bill-export` (`components/bill/BillExport.jsx`,
  `components/bill/BillContent.jsx` khi nằm trong export,
  `components/party/PartyBillExport.jsx`). Ảnh gửi Telegram phải y như cũ.
- Không đổi chữ đang có. Chữ mới chỉ khi bắt buộc (nhãn tab "Thêm",
  `aria-label` cho nút biểu tượng, câu trạng thái rỗng còn thiếu) và phải
  liệt kê trong báo cáo.

## 4. Điều tuyệt đối không được xảy ra (anti-goals)

- Màn đăng nhập hoặc màn nhập tiền trông như template chung.
- Một luồng đang chạy được trên điện thoại bị vỡ: nút bị che, thanh dưới
  đáy chồng nhau, chữ bị cắt, bảng tràn ngang cả trang.
- Ảnh bill xuất ra khác trước.
- Diff phình vì format lại cả file.

## 5. Hệ thống thiết kế (đã chốt)

### 5.1 Phông chữ

- **Be Vietnam Pro** 400/500/600/700 (Google Fonts, `index.html`) thay
  cho Fraunces + DM Sans. Phông này được vẽ cho tiếng Việt nên dấu thanh
  đều và gọn.
- `tailwind.config.js`: `fontFamily.sans` = Be Vietnam Pro + fallback hệ
  thống; `fontFamily.display` **cũng** = Be Vietnam Pro, để 41 chỗ đang
  dùng `font-display` tự đổi mà không phải sửa từng file.
- `index.css`: `.font-display` còn `letter-spacing: -0.02em`, bỏ
  `font-optical-sizing`; bỏ `font-feature-settings: "ss01", "cv11"` (chỉ
  có nghĩa với DM Sans). Giữ `.font-tabular`.
- Kiểm `font-variant-numeric: tabular-nums` thật sự làm số thẳng cột với
  Be Vietnam Pro (chụp bảng tiền). Không được thì đổi sang **Inter** và
  ghi lại lý do.
- Tiêu đề trang `text-2xl font-semibold tracking-tight`, tiêu đề khối
  `text-base font-semibold`, chữ thường `text-sm`, chữ phụ `text-xs`/`text-sm text-slate-500`.

### 5.2 Màu

- **Nền trang** `slate-50`, đặt ở `body` (`index.css`) và `Layout`. Bỏ
  `bg-gray-50` / `bone-*` làm nền trang (giữ class `bone` trong config để
  không vỡ chỗ còn dùng; dọn dần).
- **Chữ**: `slate-900` tiêu đề, `slate-700` nội dung, `slate-500` phụ,
  `slate-400` placeholder. Gom `gray-*` về `slate-*`.
- **Màu thương hiệu = xanh ngọc `emerald-700`** (`#047857`, trùng
  `theme-color` và favicon): nút chính `bg-emerald-700 hover:bg-emerald-800`,
  nền nhạt `emerald-50` + chữ `emerald-700/800`, viền focus `emerald-600`.
- **Xanh dương** thôi làm nút chính; chỉ còn cho liên kết / nhãn thông tin.
- **Trạng thái**: `emerald` = đã trả / thành công; `amber` = chờ / cảnh báo;
  `rose` = còn nợ / lỗi / xóa; `sky` = thông tin. Gom `red→rose`,
  `green→emerald`, `yellow→amber` **chỉ khi cùng nghĩa**.
- Trước khi đổi một màu, đọc xem nó có mã hóa ý nghĩa không (phân biệt
  loại bill, trạng thái trả tiền, tỉ lệ nam/nữ…). Có thì giữ ý nghĩa, chỉ
  đổi sắc độ cho đồng bộ.

### 5.3 Hình khối

- Thẻ: `rounded-2xl bg-white border border-slate-200 shadow-card`, đệm `p-4 sm:p-6`.
- Ô nhập và nút: `rounded-xl`, cao 44 px trên điện thoại (`h-11`), `sm:h-10` trên desktop.
- Nhãn trạng thái: `rounded-full px-2.5 py-0.5 text-xs font-medium`.
- Bóng: chỉ `shadow-card`, `shadow-card-hover`, `shadow-fab`, `shadow-lg` cho menu thả; bỏ `shadow-2xl`, gradient, đốm mờ.
- Focus bàn phím: `focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-1`.

### 5.4 Class dùng chung (`index.css`, `@layer components`)

| Class | Dùng cho |
|---|---|
| `.btn` | nền chung: `inline-flex items-center justify-center gap-2 rounded-xl px-4 h-11 sm:h-10 text-sm font-semibold transition`, focus ring, `disabled:opacity-50 disabled:cursor-not-allowed` |
| `.btn-primary` | `bg-emerald-700 text-white hover:bg-emerald-800 active:bg-emerald-900` |
| `.btn-secondary` | `bg-white text-slate-700 border border-slate-300 hover:bg-slate-50` |
| `.btn-ghost` | `text-slate-600 hover:bg-slate-100` |
| `.btn-danger` | `bg-rose-600 text-white hover:bg-rose-700` |
| `.btn-sm` | `h-9 px-3` — chỉ dùng trên desktop hoặc trong bảng; trên điện thoại vùng chạm vẫn ≥ 44 px |
| `.field-label` | `block text-sm font-medium text-slate-700 mb-1.5` |
| `.field-input` | `block w-full h-11 sm:h-10 rounded-xl border border-slate-300 bg-white px-3 text-base sm:text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 focus:outline-none` (`text-base` trên điện thoại để iOS không tự phóng to khi chạm ô) |
| `.card` | thẻ ở 5.3 |
| `.badge` + `.badge-emerald/amber/rose/sky/slate` | nhãn trạng thái |

`CurrencyInput` / `NumberInput` đã nhận bộ class nền thay được — truyền
`field-input` vào, không sửa logic của chúng.

### 5.5 Component mới (`src/components/ui/`)

- `icons.jsx` — biểu tượng SVG nét (đường vẽ chép từ **Lucide**, giấy phép
  ISC, ghi nguồn ở đầu file): `viewBox="0 0 24 24"`, `stroke="currentColor"`,
  `strokeWidth={1.75}`, `aria-hidden="true"`, nhận `className`. Tối thiểu:
  bill cầu (`Receipt`), bill tiệc (`UtensilsCrossed`), người chơi (`Users`),
  xếp bảng (`Trophy`), thuê xe (`Car`), master (`Settings`), quyền
  (`ShieldCheck`), `Plus`, `LogOut`, `Ellipsis` (Thêm), `X`, `ChevronDown`,
  `ChevronLeft`, `Search`, `Pencil`, `Trash2`.
- `PageHeader.jsx` — `{ title, description?, actions?, back? }`: `h1`
  theo 5.1, mô tả `text-sm text-slate-500`, `actions` nằm phải trên
  desktop, xuống dưới tiêu đề trên điện thoại; `back` là link quay lại có
  `ChevronLeft`.
- `Modal.jsx` — `{ isOpen, onClose, title, children, footer?, size? }`:
  điện thoại là **bottom sheet** (sát đáy, `rounded-t-2xl`, `max-h-[90vh]`
  cuộn trong, chừa `env(safe-area-inset-bottom)`), desktop là hộp giữa màn
  `max-w-md` / `max-w-lg`. Nền `bg-slate-900/40 backdrop-blur-sm`, bấm nền
  hoặc Esc thì đóng, `role="dialog" aria-modal="true" aria-labelledby`,
  focus vào ô đầu tiên khi mở, khóa cuộn `body` khi mở.
- `EmptyState.jsx` — `{ icon, title, description?, action? }`, căn giữa trong thẻ.

### 5.6 Khung trang (`Layout.jsx`)

Tách phần lọc menu theo quyền + chia "chính / Thêm" ra hàm thuần
`src/utils/navItems.js`, viết test trước (`navItems.test.js`, mẫu
`utils/menus.test.js`): đủ quyền, thiếu quyền, nhóm còn 1 con hạ thành
link đơn, ≤ 5 mục thì không có "Thêm", > 5 mục thì 4 mục đầu + "Thêm".

**Desktop (≥ `sm`, 640 px):**

- Thanh trên `h-16` dính đỉnh, `bg-white/80 backdrop-blur border-b border-slate-200`.
- Trái: favicon 28–32 px + "Sổ cầu lông" `font-semibold`, bấm về `/`.
- Giữa: mục menu dạng "viên" `h-9 px-3 rounded-lg text-sm font-medium`
  có biểu tượng; thường `text-slate-600 hover:bg-slate-100 hover:text-slate-900`,
  đang chọn `bg-slate-100 text-slate-900` + biểu tượng `text-emerald-700`.
  Nhóm Bill cầu / Bill tiệc giữ dropdown (`NavDropdown`), làm lại kiểu:
  `rounded-xl border shadow-lg p-1`, mục `rounded-lg h-9`.
- `sm`–`lg` (640–1023): chỉ hiện 4 mục chính, phần còn lại vào dropdown
  "Thêm". `≥ lg` hiện đủ. Không được tràn hay xuống dòng ở 640, 768,
  1024, 1280 với tài khoản đủ 7 mục.
- Phải: nút tài khoản = vòng tròn chữ cái đầu tên (`bg-emerald-100
  text-emerald-800`) + tên (chỉ `≥ lg`) + `ChevronDown`; mở ra tên, vai
  trò, đường kẻ, "Đăng xuất". Đóng khi bấm ngoài / Esc như `NavDropdown`.

**Điện thoại (< `sm`):**

- Thanh trên `h-14`: favicon + "Sổ cầu lông", phải là vòng tròn tài khoản (mở sheet "Thêm").
- **Thanh tab dưới đáy** cố định: `bg-white/90 backdrop-blur border-t
  border-slate-200`, cao 64 px + `env(safe-area-inset-bottom)`. Tối đa 5
  ô: 4 mục chính + "Thêm" (≤ 5 mục thì hiện hết, không có "Thêm"). Mỗi ô
  biểu tượng 22 px + nhãn `text-[11px] font-medium`, đang chọn
  `text-emerald-700` có viên nền `bg-emerald-50` sau biểu tượng; vùng chạm ≥ 44 px.
- Thứ tự mục: Bill cầu → Bill tiệc → Người chơi → Xếp bảng → Thuê xe →
  Master → Quyền (lọc theo quyền như hiện nay). Nhóm trên tab trỏ thẳng
  vào trang danh sách (tạo mới đã có FAB / nút trên trang danh sách).
- "Thêm" mở bottom sheet (dùng `Modal`): các mục còn lại, thẻ tài khoản
  (tên, vai trò), nút "Đăng xuất".
- Bỏ drawer trượt trái hiện tại.
- **Ẩn thanh tab** ở các màn đã có thanh hành động riêng dưới đáy:
  `/bills/create`, `/bills/:id/edit`, `/party-bills/create`,
  `/party-bills/:id/edit` (đây là màn "đẩy vào", có nút quay lại).
- `/car-rental` vẫn hiện thanh tab: thanh tính tiền của
  `CarRentalCalculator` đẩy lên **trên** thanh tab, không chồng nhau.
- FAB ở `Dashboard` và `PartyBills` nâng lên trên thanh tab khi thanh tab hiện.
- `main` có `pb-[calc(5rem+env(safe-area-inset-bottom))] sm:pb-6` khi thanh tab hiện.
- `index.html`: thêm `viewport-fit=cover` vào meta viewport (không có thì
  `env(safe-area-inset-*)` trên iPhone luôn bằng 0).
- Kiểm đệm ngang: `main` hiện không có `px` trên điện thoại, nhiều màn tự
  thêm `px-4`. Đổi chỗ đệm thì không được đệm đôi hoặc mất đệm ở màn nào.

### 5.7 Mẫu cho từng loại màn

- Đầu mỗi màn dùng `PageHeader`.
- Bảng trên desktop nằm trong `.card` (`overflow-hidden`): `thead
  bg-slate-50 text-xs font-medium text-slate-500` (**không** viết hoa
  toàn bộ), hàng `border-t border-slate-100`, số căn phải + `font-tabular`.
- Ở 390 px không bảng nào được làm tràn cả trang: màn đã có bản thẻ cho
  điện thoại thì làm lại kiểu; chưa có thì đổi sang danh sách thẻ hoặc cho
  cuộn ngang **bên trong** thẻ (người triển khai chọn, ghi lại lý do).
- Tab trong màn (Master…): khung `bg-slate-100 rounded-xl p-1`, tab đang
  chọn `bg-white shadow-sm rounded-lg`, cuộn ngang được trên điện thoại.
- Mọi hộp thoại tự viết (`fixed inset-0 …` — Players 3, Shuttles 4,
  Tournament 3, Menus, Ratios, Roles, PaymentAccounts, Dashboard,
  CreatePartyBill, EditPartyBill, PlayerSelector, QuickAddMenu, 3 dialog
  trong `common/`) chuyển sang `Modal`, giữ nguyên nội dung và hành vi
  submit. `ConfirmDialog` giữ nguyên props.
- Danh sách rỗng dùng `EmptyState`. Đang tải giữ `.skeleton`.
- Emoji đang làm biểu tượng giao diện (menu, nút, tiêu đề) đổi sang
  `icons.jsx`. Emoji nằm trong dữ liệu người dùng hoặc trong `#bill-export` giữ nguyên.
- Mọi ô nhập có `<label htmlFor>` gắn đúng `id`; nút chỉ có biểu tượng có `aria-label`.

### 5.8 Đăng nhập

- Một thẻ giữa màn trên nền `slate-50`, không gradient, không đốm.
- Đầu thẻ: favicon 48 px, "Sổ cầu lông" `text-2xl font-semibold`, dưới là
  "Chào mừng trở lại" (chữ cũ) và **một câu mô tả app** (chữ mới, chờ chủ
  dự án gật): "Chia tiền buổi chơi, bill tiệc và thuê xe cho nhóm cầu lông."
- Ô email / mật khẩu dùng `.field-label` / `.field-input`, giữ nguyên
  `id`, `name`, `autocomplete`, placeholder, cách báo lỗi; nút "Đăng nhập" là `.btn-primary w-full`.
- Màn "Đang tải…", "Không kết nối được máy chủ", "Bạn chưa được cấp quyền…"
  trong `App.jsx` làm lại cùng kiểu (thẻ + biểu tượng + nút `.btn-primary`), giữ chữ.

## 6. Chia đợt

| Đợt | Việc | File được sửa |
|---|---|---|
| **1 — Nền móng** | 5.1–5.6, 5.8; làm lại `common/*` trên `Modal`; dựng máy chủ giả + script chụp ảnh dùng chung | `index.html`, `tailwind.config.js`, `src/index.css`, `src/App.jsx`, `src/components/Layout.jsx`, `NavDropdown.jsx`, `components/ui/*` (mới), `components/common/*`, `utils/navItems.js` (+ test), `screens/auth/Login.jsx`; FAB ở `Dashboard` / `PartyBills` và thanh dưới của `CarRentalCalculator` chỉ sửa đúng class vị trí |
| **2 — Màn quản lý** | 5.7 cho các màn | `screens/players`, `master`, `ratios`, `menus`, `shuttles`, `payment-accounts`, `roles`, `tournament`, `car-rental`, `components/car-rental/*` |
| **3 — Bill** | 5.7 cho các màn bill, ngoài `#bill-export` | `screens/dashboard`, `screens/bills`, `screens/party`, `components/bill/*` (trừ nội dung export), `components/party/*` (trừ nội dung export) |

Đợt 2 và 3 chạy song song trên hai worktree tách từ commit cuối của đợt
1, **không** sửa file của đợt 1. Cần thêm class / component chung thì
dùng class Tailwind tại chỗ và ghi đề xuất vào báo cáo.

## 7. Cổng kiểm mỗi đợt (trong `FRONTEND`)

1. `npm test` — 0 failed.
2. `npx eslint .` — không thêm lỗi / cảnh báo so với mốc chạy trên `main`.
3. `VITE_API_URL=/api npx vite build --outDir <scratchpad>/…/dist` — ok
   (cảnh báo chunk > 500 kB có sẵn).
4. `git diff --stat main` — mỗi file chỉ đổi chỗ cần đổi, không format lại cả file.
5. Ảnh chụp thật qua máy chủ giả (không bao giờ qua máy chủ OVH) ở 390 ×
   844 (`isMobile`, `hasTouch`, `deviceScaleFactor: 2`) và 1280 × 800;
   đợt 1 thêm 640, 768, 1024 cho khung trang. Dữ liệu khó: tên ~30 ký tự,
   bill 25 người, tiền hàng chục triệu, tiền lẻ phải làm tròn nghìn, danh
   sách rỗng, người còn nợ bill cũ, tài khoản đủ 7 mục menu và tài khoản
   chỉ 2 mục.
6. Đợt 3: bấm xuất ảnh bill cầu (có bill con) và bill tiệc, so với ảnh
   xuất từ bản build `main` cùng dữ liệu giả — phải giống nhau.

## 8. Ghi lại khi triển khai

Người triển khai bổ sung vào cuối file này: chỗ chệch so với thiết kế và
lý do, chữ mới phát sinh, quyết định tự chọn (5.1 phông dự phòng, 5.7
bảng trên điện thoại).
