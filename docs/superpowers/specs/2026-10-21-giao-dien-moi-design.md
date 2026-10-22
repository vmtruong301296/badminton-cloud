# Thiết kế: làm mới giao diện toàn app theo phong cách web app hiện đại

Ngày: 2026-10-21
Trạng thái: chủ dự án giao "làm luôn" (21/10/2026), triển khai trên nhánh `feature/giao-dien-moi`; chủ dự án chạy thử và duyệt giao diện cùng chữ mới ở mục 8 (22/10/2026), merge `main` và deploy
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

### Đợt 1 — nền móng (triển khai 21/10/2026)

**Chỗ chệch so với thiết kế (kèm lý do)**

- **Phông: Inter, không phải Be Vietnam Pro** (quyết định theo 5.1). Đo trên trang thật bằng Chrome:
  với Be Vietnam Pro, `tabular-nums` không đổi gì ("1.111.111" rộng 68,09 px, "0.000.000" rộng 107,84 px,
  đều như nhau khi bật `tabular-nums`) vì phông không có tính năng `tnum`; với Inter bật `tabular-nums` thì
  cả ba chuỗi đều 101,47 px. Số tiền thẳng cột quan trọng hơn dấu thanh, nên đổi sang Inter (có bộ tiếng Việt).
  `fontFamily.sans` và `fontFamily.display` đều là Inter. Be Vietnam Pro chỉ tồn tại ở commit `style(ui): phông Be Vietnam Pro…`.
- **`#bill-export` giữ `font-feature-settings: "ss01", "cv11"` trong `index.css`.** Bỏ tính năng này khỏi `body`
  (5.1) làm chữ Arial đậm trong ảnh xuất khác đi (đo được 103 114 điểm ảnh khác ở ảnh bill cầu). Đặt lại
  riêng cho `#bill-export` thì ảnh xuất bill cầu (390 và 1280) và bill tiệc (390 và 1280) giống bản `main`
  từng điểm ảnh (0 điểm khác). Khi nào đợt 3 muốn bỏ hẳn thì phải chấp nhận ảnh xuất đổi nét chữ.
- **Thanh trên desktop: biểu tượng của mục menu chỉ hiện từ `xl` (1280)**, không phải từ `sm`. Ở 1024 với tài khoản đủ 7
  mục, biểu tượng + chữ tràn và đè lên nút tài khoản. Cách chốt: 640–1023 hiện 4 mục chính + "Thêm" chỉ có chữ;
  ≥ 1024 (`lg`) hiện đủ 7 mục chỉ có chữ; ≥ 1280 thêm biểu tượng. Chữ "Sổ cầu lông" cạnh logo ẩn ở 640–767; tên người dùng
  cạnh vòng tròn tài khoản chỉ hiện từ `xl` (spec ghi `lg`); mũi tên của nút tài khoản chỉ từ `lg`.
- **Nhóm bị hạ thành link đơn lấy nhãn của nhóm** ("Bill cầu" / "Bill tiệc") thay vì nhãn của mục con ("Danh sách bill cầu"),
  vì nhãn tab dưới đáy chỉ vừa vài chữ. Chỉ ảnh hưởng người chỉ có quyền xem (không có quyền tạo).
- **Mục menu sáng cả ở trang chi tiết / sửa bill** (`/bills/:id`, `/party-bills/:id`): `isNavItemActive` có `activePrefixes`
  (trước đây chỉ khớp đúng đường dẫn). Có test.
- **Thêm ngoài danh sách file**: `components/ProtectedRoute.jsx` (màn "Đang tải…" và "Không có quyền truy cập" dùng
  chung `StatusScreen` với `App.jsx`, giữ chữ), `components/ui/StatusScreen.jsx`, `components/ui/useDismiss.js` (đóng menu thả khi
  bấm ngoài / Esc, dùng chung cho `NavDropdown` và menu tài khoản).
- **`CurrencyInput`, `NumberInput`, `DatePicker`, `ThousandHint`**: ngoài việc nhận `field-input`, đổi bộ class mặc định sang
  slate / emerald `rounded-xl` (để màn chưa chuyển không còn xanh dương cũ); `CurrencyInput` thêm `inputMode="numeric"` và nhận
  `...props` (id, aria-label, onKeyDown), `NumberInput` thêm `inputMode="decimal"`; `ThousandHint` cao tối thiểu 36 px.
  Logic không đổi.
- **`.btn-sm`**: cao 36 px nhưng có vùng chạm mở rộng thêm 4 px mỗi phía trên điện thoại (≥ 44 px).
- **Màn đăng nhập giữ câu cũ "Hệ thống quản lý thanh toán cầu lông"** dưới thẻ (spec không nói bỏ), thêm câu mô tả mới trong thẻ.
- Thanh tab có tối đa 5 ô; với tài khoản đủ 7 mục thì "Thuê xe" nằm trong "Thêm" (thứ tự 5.6), nên ở `/car-rental` ô "Thêm" sáng.
- Modal (quyết định tự chọn): render vào `document.body` bằng portal (không bị `backdrop-blur` của thanh trên làm lệch
  `fixed`), giữ Tab quay vòng trong hộp, trả focus về chỗ cũ khi đóng, đếm số hộp đang mở để khóa / mở cuộn trang đúng khi mở chồng.
  `prefers-reduced-motion` tắt hiệu ứng trượt.
- Chữ cái trong vòng tròn tài khoản là chữ cái đầu của **tên gọi** (từ cuối: "Võ Trường" → T), không phải chữ đầu của họ.

**Chữ mới (chờ chủ dự án gật; ghi ngày khi gật)**

- Nhãn tab dưới đáy và tiêu đề sheet: "Thêm" (cũng là nút dropdown trên desktop 640–1023).
- "Tài khoản": `aria-label` của nút vòng tròn tài khoản; tiêu đề sheet khi tài khoản ít hơn 6 mục (không có "Thêm").
- "Đóng": `aria-label` nút X của `Modal`.
- "Điều hướng chính": `aria-label` của hai thanh điều hướng.
- Câu mô tả ở màn đăng nhập: "Chia tiền buổi chơi, bill tiệc và thuê xe cho nhóm cầu lông." (từ spec 5.8, chờ gật).
- `EmptyState`/`PageHeader` chưa dùng chữ nào; nhãn nút quay lại (`back.label`) do từng màn truyền vào ở đợt sau.

**Kiểm ở đợt 1**: `npm test` 43 passed (có 18 test mới cho `navItems`); `eslint` 6 lỗi + 8 cảnh báo, bằng `main`; build ok;
ảnh xuất bill giống `main` từng điểm ảnh; ảnh chụp qua máy chủ giả ở 390 / 640 / 768 / 1024 / 1280 (khung trang), cả tài khoản đủ 7 mục
và tài khoản 2 mục.

**Ghi cho đợt 2 / 3**

- `main` không có `px` trên điện thoại (như cũ); mọi màn tự có `px-4` / `p-3` nên không đệm đôi, nhưng màn nào bỏ đệm của mình đi thì mất lề.
- `PageHeader` chưa được dùng ở đâu; màn mới nên dùng và bỏ nhãn trên tiêu đề viết hoa rải chữ (`QUẢN LÝ CHI TIÊU`, `BILL TIỆC #1`).
- Còn nút `bg-blue-600` / `bg-green-600` / `bg-red-600` và FAB `emerald-600` ở các màn chưa chuyển; chúng khác sắc với nút `.btn-primary` (`emerald-700`).
- `ConfirmDialog` luôn có nút "Xóa" (như cũ). Dùng cho việc khác "Xóa" thì cần thêm prop ở đợt sau.

### Đợt 2 — màn quản lý (21/10/2026)

**Chỗ chệch so với thiết kế (kèm lý do)**

- Bảng dưới `md` giữ **dạng thẻ** (Người chơi, Mức tính, Menu, Loại cầu, Quyền): đã có sẵn bản thẻ cho điện thoại, làm lại kiểu
  cho đồng bộ thay vì cho bảng cuộn ngang. Xếp bảng thêm danh sách thẻ VĐV. Bảng trong Modal lịch sử nhập kho **cuộn ngang
  trong thẻ** (chưa có bản thẻ, không nên tràn cả trang).
- Các tab con của Master (Mức tính, Menu nước, Loại cầu, TK nhận tiền) dùng `h2`, không dùng `PageHeader`, để một màn không có hai `h1`.
- Bỏ `animate-pulse` ở cảnh báo "Sắp hết cầu". Biểu tượng 🏆 trong kết quả thuê xe đổi thành nhãn "Rẻ nhất". Emoji nằm trong văn bản
  để sao chép giữ nguyên. Tournament bỏ `max-w-6xl` cho cùng bề ngang với các màn khác.

**Chữ mới (chờ chủ dự án gật)**: câu trạng thái rỗng "Chưa có người chơi", "Không tìm thấy người chơi", "Chưa có mức tính",
"Chưa có menu", "Chưa có loại cầu", "Chưa có quyền nào"; nhãn "Rẻ nhất" (thay 🏆); các `aria-label` / nhãn ẩn cho ô nhập và nút biểu tượng.

### Đợt 3a — bill cầu (21/10/2026)

- `BillContent` (không nằm trong ảnh xuất) làm lại thành **hàng thẻ cho mọi cỡ**: bảng 8 cột không vừa cột ~600 px (desktop 2 cột)
  hay ~360 px (điện thoại). "Đã TT" thành nút có chữ, cao 44 px.
- Bỏ các nhãn chữ hoa trên tiêu đề; "Bill chính / con" thành badge.
- Dashboard gộp thành một bảng, thêm nhãn "Quá hạn"; xóa khối lọc cũ đã `hidden`. Hộp Thống kê xếp một cột.
- Bỏ `animate-pulse` ở banner dưới 10 ống. Màu "đã trả" của bill con đổi từ xanh dương sang xanh ngọc (đúng nghĩa trạng thái).
- Chữ mới: nhãn "Quá hạn"; còn lại chỉ có chữ cho trình đọc màn hình.

### Đợt 3b — bill tiệc (21/10/2026)

- Bỏ các nhãn chữ hoa trên tiêu đề; "Bill tiệc #N" chuyển xuống dòng mô tả. Nút chính màn sửa đổi từ amber sang emerald.
- Bỏ 🎉 ở "Tất cả đã thanh toán". Nút chi tiết trên điện thoại xếp lưới 2×2.
- Không thêm `ThousandHint` / Enter nhảy ô (form cũ không có). Chữ mới chỉ là `aria-label`.
- Ảnh xuất bill cầu và bill tiệc: 0 điểm khác so với `main` ở mọi đợt.
- Lỗi có sẵn, không sửa trong đợt này: `formatRatio` in `22.250000000000004` ở "Tóm tắt Bill".

### Đợt 4 — gom phần chung và kiểm toàn bộ (22/10/2026)

Mỗi mục một commit, giao diện chỉ đổi đúng ý mục đó (so ảnh trước / sau từng màn: chỉ khác ở nút Xóa và biểu tượng).

1. **Biểu tượng**: mọi biểu tượng về `components/ui/icons.jsx` (thêm `Download`, `Upload`, `Send`, `CalendarDays`, `Check`, `Circle`,
   `Clock`, `ChartLine`, `Target`). Xóa `party/partyIcons.jsx` và mọi SVG viết tại chỗ (BillDetail, Dashboard, BillContent, CreateBill,
   EditBill); nơi nét dày 2 / 2,5 thì truyền `strokeWidth`. Trả biểu tượng cho nút Import (`Upload`), Xuất bảng (`Download`), Xếp bảng (`Target`).
   Không thêm `ChevronRight` vì chưa có chỗ dùng.
2. **Nút**: `.btn` có `whitespace-nowrap`; thêm `.btn-icon` (vuông, 44 px / 40 px từ `sm`), `.btn-danger-soft` (viền rose nhạt, nền trắng,
   có kiểu disabled) và `.btn-danger-ghost` (chữ rose không viền; **thêm ngoài yêu cầu** vì có 11 chỗ lặp `!text-rose-600 hover:!bg-rose-50`).
   Các nút xóa biểu tượng trước đây viền xám / chỉ hóa rose khi rê chuột nay luôn có viền rose nhạt (không còn gì chỉ có khi hover).
3. **Tab**: `.tab-list` / `.tab` (đang chọn theo `aria-selected="true"`), thay 3 chỗ lặp (Master, Tournament, CarRentalComparison); đệm ngang
   chuẩn `px-2 sm:px-4`.
4. **Ô nhập**: `DatePicker`, `NumberInput` nhận `baseClassName`; 15 chỗ truyền `field-input` qua `className` đổi sang `baseClassName`.
5. **`PageHeader`**: `description` nhận node, khung bọc là `div`.
6. **`ConfirmDialog`**: thêm `confirmLabel` (mặc định "Xóa"), `confirmVariant` (`danger` / `primary`). Không chuyển `confirm()` / `alert()`.
7. **FAB** ở Dashboard / PartyBills đã dùng `emerald-700` / `hover:emerald-800`; không cần sửa.

**Lỗi tìm thấy khi kiểm và đã sửa**

- `fix(bill)`: màn Tạo / Sửa bill cầu, ô "Ngày đánh" bị bóp còn ~15 px và đè nhãn "Tổng tiền sân" ở 390: ô "Ghi chú" còn `col-span-2`
  trong lưới `grid-cols-1` (đợt 3a đổi lưới nhưng quên bỏ), làm sinh cột ẩn thứ hai.
- `style(ui)`: tiêu đề màn Thuê xe ở desktop bị căn giữa (`mx-auto max-w-5xl`) lệch so với mọi màn khác; bỏ `mx-auto`, giữ độ rộng tối đa của form.

**Kiểm**: `npm test` 43 passed; `eslint` 6 lỗi + 8 cảnh báo bằng mốc; build ok; không route nào tràn ngang ở 390 (admin, empty, limited, guest);
lề trái `h1` đều 16 px; ảnh xuất bill cầu (có bill con) và bill tiệc ở 390 / 1280: 0 điểm khác `main`.

**Còn lại, không sửa**: màn Tạo Bill ở desktop có thẻ "Loại cầu" kéo cao bằng thẻ "Thông tin cơ bản" (khoảng trống lớn khi chưa thêm cầu);
chỉ thẩm mỹ, thuộc bố cục đợt 3a. `alert()` / `confirm()` (~100 chỗ) vẫn là việc tiếp theo.
