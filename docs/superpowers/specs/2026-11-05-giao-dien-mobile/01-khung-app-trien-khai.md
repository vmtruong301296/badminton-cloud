# 01 Khung app + nền — triển khai (đợt 0, phương án A)

Ngày: 2026-11-05 · Nhánh `feature/giao-dien-mobile` · Spec: `../2026-11-05-giao-dien-mobile-design.md` ·
Đề xuất: `01-khung-app-de-xuat.html` (mục 5, 16) · Chủ dự án duyệt hướng 05/11/2026.

Đợt 0 dựng phần nền cho 5 nhóm đợt 1. Mọi thay đổi giao diện nằm dưới `sm` (640 px) trừ chỗ ghi rõ.
Không đổi route, quyền, API, cách tính tiền, ảnh bill xuất.

## 1. API cho các nhóm đợt 1

Quy tắc chung:

- Class trong `@layer components` của `index.css` chỉ vào CSS khi tên class xuất hiện **nguyên chữ** trong
  file `.jsx` (Tailwind quét mã). Không ghép tên class bằng chuỗi (`"chip-" + x`).
- Không sửa `Layout.jsx`, `index.css`, `components/ui/*` (trừ `PeriodStepper`), `common/*` của nhóm 01. Thiếu
  gì thì dùng Tailwind tại chỗ và ghi đề xuất vào báo cáo. Biểu tượng: thêm vào cuối `icons.jsx` trong commit
  riêng (spec mục 4).

### 1.1 Thanh trên (M1): tiêu đề, nút quay lại, ⋯, ẩn tab

Trên điện thoại chỉ còn **một thanh 56 px** (`Layout.jsx`). Màn không sửa Layout: `PageHeader` tự đưa tiêu đề,
nút quay lại và menu ⋯ lên thanh (qua `createPortal` vào khe của Layout, file `ui/AppBar.jsx`);
`description` và `actions` ở lại trong nội dung. Desktop giữ nguyên `PageHeader` như cũ.

```jsx
// Màn gốc (đích trên tab): tiêu đề trên thanh, cạnh biểu tượng app và vòng tài khoản
<PageHeader
  title="Bill cầu"
  description={<>13 bills hiển thị</>}
  barAction={
    <button type="button" className="app-bar-btn" aria-label="Thống kê" onClick={openStats}>
      <ChartLine className="h-6 w-6" />
    </button>
  }
/>

// Màn đẩy vào: ‹ + tiêu đề + ⋯ (tab tự ẩn, không có vòng tài khoản)
<PageHeader
  back={{ to: "/", label: "Danh sách bills" }}         // aria-label của nút ‹ = label
  title={`Chi tiết Bill #${bill.id}`}
  description={<BillBadges bill={bill} />}
  menu={[
    { label: "Sửa bill", icon: Pencil, to: `/bills/${bill.id}/edit` },
    { label: "Bill con", icon: Plus, onClick: () => navigate(`/bills/create?parent_id=${bill.id}`) },
    hasPermission("bills.delete") && { label: "Xóa bill", icon: Trash2, danger: true, onClick: () => setDeleteConfirm(true) },
  ]}
/>
```

| Prop của `PageHeader`                      | Ý nghĩa                                                                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                                    | chữ / node; trên thanh cắt "…" một dòng (màn gốc 20/600, màn đẩy vào 18/600)                                                                                                       |
| `back`                                     | `{ to, label }` → màn đẩy vào. Desktop vẫn là link "‹ label" trên tiêu đề như cũ                                                                                                   |
| `menu`                                     | `[{ label, icon, onClick \| to, danger, disabled }]`; giá trị falsy bị bỏ qua. Rỗng → không có ⋯. Chỉ điện thoại; desktop dùng `actions`. Mục `danger` vẫn phải mở `ConfirmDialog` |
| `menuTitle`                                | tiêu đề sheet ⋯ (mặc định = `title`)                                                                                                                                               |
| `barAction`                                | 1 nút 44 px trên thanh của màn gốc: `className="app-bar-btn"` + `aria-label`                                                                                                       |
| `hideTabBar`                               | ẩn tab dù đường dẫn chưa nằm trong danh sách màn đẩy vào                                                                                                                           |
| `description`, `actions`, `compactActions` | như cũ; trên điện thoại ở lại trong nội dung                                                                                                                                       |

- Màn muốn tiêu đề trên thanh mà **không** có khối PageHeader trong nội dung: dùng thẳng
  `<AppBar title back menu menuTitle action hideTabBar />` (`ui/AppBar.jsx`) — nhớ tự hiện tiêu đề cho desktop.
- Mỗi màn chỉ một `PageHeader` / `AppBar`.
- Màn chưa đặt gì (đang tải, lỗi tải, màn chưa chuyển): thanh hiện **nhãn tab** của mục đang mở
  (`screenTitle`), màn đẩy vào có **nút ‹ dự phòng** theo đường dẫn (`pushedBackLink`): `/bills/:id`,
  `/bills/create` → "/", `/party-bills/:id`, `/party-bills/create` → "/party-bills", `/bills/:id/edit` →
  `/bills/:id`, `/party-bills/:id/edit` → `/party-bills/:id`. Không bao giờ mất đường quay lại.
- **Màn đẩy vào** (tab ẩn, ‹ thay biểu tượng app) = danh sách `PUSHED_SCREENS` trong `utils/navItems.js`
  (có test): tạo / sửa / chi tiết bill cầu và bill tiệc (quyết định 3). Màn có `back` cũng
  được coi là màn đẩy vào.

### 1.2 Biến khung

```css
--app-bar-h: 56px; /* + env(safe-area-inset-top) */
--tab-bar-h: 56px; /* gồm viền trên; + env(safe-area-inset-bottom) */
--action-bar-h: 68px; /* 12 + nút 44 + 12; + vùng an toàn */
```

Đừng viết cứng `4rem` / `4.25rem`. Ví dụ đáy riêng: `bottom-[calc(var(--tab-bar-h)+env(safe-area-inset-bottom))]`.
Nội dung **tự chừa đáy** khi màn có `.fab` hoặc `.action-bar` (`.app-main:has(...)`) → bỏ `pb-16` / `pb-24`
tự thêm khi chuyển sang `.fab` / `ActionBar`. Ô nhập có `scroll-margin` để không nằm sau thanh trên / ActionBar.

### 1.3 `ActionBar` (M2)

```jsx
import ActionBar from "../../components/ui/ActionBar";

<ActionBar
  summary={{ label: "Tổng tiền", value: formatCurrency(preview.total_amount),
             onClick: () => setSummaryOpen(true), ariaLabel: "Xem tóm tắt bill" }}  // onClick tùy chọn
>
  <button type="submit" form="bill-form" disabled={loading} className="btn btn-primary flex-1">
    {loading ? <><Loader className="h-4 w-4 animate-spin" />Đang tạo…</> : "Tạo Bill"}
  </button>
</ActionBar>

// Màn gốc còn tab (Thuê xe): đứng ngay trên tab
<ActionBar overTab>
  <button className="btn btn-secondary flex-1">Copy kết quả</button>
  <button className="btn btn-primary flex-1">Lưu lại</button>
</ActionBar>
```

Chỉ điện thoại (`sm:hidden`) → desktop vẫn cần nút ở chỗ cũ. Tối đa 1 nút chính + 1 nút phụ. Nền trắng đặc,
bàn phím phủ lên (không nâng theo).

### 1.4 `useToast` (M8)

```jsx
import useToast from "../../components/ui/useToast";

const toast = useToast();
toast.success("Đã gửi bill qua Telegram thành công!"); // 4 s
toast.error("Có lỗi xảy ra khi xóa bill", { onRetry: handleDelete }); // 7 s, "Thử lại" + nút Đóng
toast.info("Người chơi đã tồn tại. Đã chọn người này"); // 5 s
```

Một thông báo mỗi lúc (mới thay cũ). Vị trí tự tính: trên tab / FAB / ActionBar (CSS `:has`), desktop giữa đáy.
Không dùng cho kiểm form (M14), lỗi tải trang (M13), lỗi khi đang mở sheet (hiện khối rose trong sheet — thông
báo nằm dưới lớp nền mờ). Dùng nguyên câu `alert()` cũ. `console.error` cũ giữ nguyên.

### 1.5 `Modal` (M5) và `ConfirmDialog`

| Prop mới       | Giá trị                                   | Dùng khi                                                                                       |
| -------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `initialFocus` | `"field"` (mặc định, như cũ) \| `"panel"` | sheet chọn / lọc / menu / tóm tắt / sửa vai trò: không bật bàn phím khi mở                     |
| `height`       | `"auto"` (mặc định) \| `"tall"`           | sheet chọn nhiều: cao cố định ~85dvh (desktop `min(80vh,720px)`), danh sách không nhảy khi lọc |
| `dismissible`  | `true` (mặc định) \| `false`              | đang xử lý: bấm nền / Esc / nút đóng không đóng                                                |

Không cần prop: cao tối đa `90dvh`; khi bàn phím ảo bật, cả sheet nâng lên ngay trên bàn phím
(`window.visualViewport`), ô vừa focus tự cuộn vào chỗ thấy. **Cần thử trên iPhone + Android thật** (trình giả
lập không có bàn phím).

```jsx
// Sheet chọn nhiều (03, 05)
<Modal isOpen={open} onClose={close} title="Chọn người chơi" height="tall" initialFocus="panel"
  footer={<button type="button" className="btn btn-primary w-full" onClick={close}>Xong · {n} người</button>} />

// Sheet sửa có Xóa ở đầu chân (06)
footer={<div className="flex gap-2">
  <button type="button" className="btn btn-danger-soft btn-icon" aria-label="Xóa"><Trash2 className="h-4 w-4" /></button>
  <button type="button" className="btn btn-secondary flex-1">Hủy</button>
  <button type="submit" form="f" className="btn btn-primary flex-1">Lưu</button></div>}

// ConfirmDialog đang gọi API: nút quay, không đóng, không bấm đúp
<ConfirmDialog isOpen={deleteConfirm} busy={deleting} onClose={() => setDeleteConfirm(false)}
  onConfirm={handleDelete} title="Xác nhận xóa bill" message="…" />
```

`ConfirmDialog` `message` nhận node (đổi `<p>` → `<div>`, hình như cũ).

### 1.6 `EmptyState` (M13)

```jsx
<EmptyState tone="error" title="Không tải được danh sách bill" onRetry={loadBills} />  // vòng rose, CircleAlert, role=alert, nút "Thử lại"
<EmptyState compact icon={Inbox} title="Chưa có mức tính" />                          // đệm 24 thay 48
```

### 1.7 Class M3–M17 (`index.css`)

**M3 · hàng danh sách** — cả hàng là một `Link` / `button`, không nút Xóa trên hàng, cao ≥ 64 px:

```jsx
<ul className="list-card">
  <li>
    <Link to={`/bills/${b.id}`} className="list-row">
      {" "}
      {/* + list-row-child (bill con) / list-row-warn (quá hạn) */}
      <div className="list-row-text">
        <div className="list-row-title">{formatDateShort(b.date)}</div>
        <div className="list-row-sub">#{b.id} · 3 người chưa TT</div>
      </div>
      <div className="list-row-end">
        <span className="amount">{formatCurrency(b.total_amount)}</span>
        <span className="badge badge-amber">TT 1 phần</span>
      </div>
      <ChevronRight className="list-row-chevron" />
    </Link>
  </li>
</ul>
```

**M3b · hàng có nút đuôi** (nút có chữ ≥ 84×44, không bao giờ là Xóa, không lồng nút trong nút; bill cầu và
bill tiệc cùng kiểu):

```jsx
<li className="list-row list-row-split">
  <button type="button" className="list-row-main" onClick={openPlayer}>
    <div className="list-row-text">…</div>
    <span className="amount">{formatCurrency(p.total_amount)}</span>
  </button>
  <button
    type="button"
    className={`btn list-row-action ${p.is_paid ? "btn-primary" : "btn-secondary"}`}
  >
    Đã TT
  </button>
</li>
```

**M3c · hàng mở tại chỗ** (mỗi lúc một hàng mở — logic của màn):

```jsx
<li>
  <button
    type="button"
    className="list-row"
    aria-expanded={open}
    aria-controls={`p-${id}`}
    onClick={toggle}
  >
    <div className="list-row-text">…</div>
    <ChevronDown className="list-row-chevron" />{" "}
    {/* tự xoay khi aria-expanded="true" */}
  </button>
  {open && (
    <div id={`p-${id}`} className="list-row-panel">
      …
    </div>
  )}
</li>
```

**M4 · chip lọc** — nút "Lọc" ghim trái (ngoài vùng cuộn), chip cuộn ngang; chip bật = `aria-pressed="true"`
(CSS tự vẽ ✓); ≤ 4 lựa chọn một-chọn thì chỉ chip, không nút "Lọc":

```jsx
<div className="chip-bar">
  <button
    type="button"
    className="chip"
    aria-label={`Lọc (${count})`}
    onClick={openFilter}
  >
    <SlidersHorizontal className="h-4 w-4" />
    Lọc{count > 0 && <span className="chip-count">{count}</span>}
  </button>
  <div className="chip-row">
    <button type="button" className="chip" aria-pressed={status === "unpaid"}>
      Chưa TT
    </button>
    <span className="chip chip-applied">
      01/10 – 31/10
      <button type="button" className="chip-remove" aria-label="…">
        <X className="h-4 w-4" />
      </button>
    </span>
  </div>
</div>
```

**M7 · số tiền**: in qua `formatCurrency` / `formatCurrencyRounded`; `.amount` (17/700, hàng) và `.amount-lg`
(20/700, số chính), đều `tabular-nums` + không xuống dòng.

**M9 · FAB**: `<Link to="/bills/create" className="fab fab-enter" aria-label="Tạo bill mới"><Plus /></Link>` —
56 px, đáy = tab + vùng an toàn + 16, desktop `md:hidden`.

**M10 · đầu nhóm dính** (h2, dính dưới thanh trên):

```jsx
<h2 className="group-head">
  <span className="group-head-title">Tháng 10/2026</span>
  <span className="group-head-meta">
    8 bill · còn thiếu {formatCurrency(x)}
  </span>
</h2>
```

**M11 · ô tóm tắt**: `<button className="stat-tile" aria-haspopup="dialog">` (CSS tự vẽ ›), `<div className="stat-tile">`
chỉ xem, `aria-pressed="true"` = đang chọn. Con: `.stat-tile-label`, `.stat-tile-value`, `.stat-tile-sub`.
Tối đa 2 ô / hàng ở 360–430.

**M14 · lỗi tại ô**:

```jsx
<input
  id="name"
  className="field-input"
  aria-invalid={!!err}
  aria-describedby={err ? "name-err" : undefined}
/>;
{
  err && (
    <p id="name-err" className="field-error">
      <CircleAlert />
      {err}
    </p>
  );
}
```

Khi bấm nút chính: kiểm hết, `scrollIntoView({ block: "center" })` + focus ô lỗi đầu tiên.

**M15 · hàng menu trong sheet**: `.menu-row` (+ `aria-current="page"` đang ở, `.menu-row-danger`), con
`.menu-row-icon` (bọc biểu tượng), `.menu-row-chevron` (`ChevronRight`, chỉ cho điều hướng).

**M16 · chọn nhanh 2–3 lựa chọn**:

```jsx
<div role="radiogroup" aria-labelledby="gt" className="choice-list">
  <button
    type="button"
    role="radio"
    aria-checked={g === "male"}
    className="choice"
    onMouseDown={(e) =>
      e.preventDefault()
    } /* tùy chọn: không lấy focus khỏi ô đang gõ */
    onClick={() => setG("male")}
  >
    Nam
  </button>
  …
</div>
```

**M17 · ô số** (mặc định giữ hành vi cũ):

```jsx
<NumberInput stepper min={1} value={days} onChange={setDays}
  decrementLabel="Bớt 1 ngày" incrementLabel="Thêm 1 ngày" wrapperClassName="w-40" />
<NumberInput baseClassName="field-input" suffix="L/100km" selectOnFocus value={v} onChange={setV} />
<CurrencyInput baseClassName="field-input" suffix="₫" selectOnFocus value={m} onChange={setM} />
```

Nút −/+ 44 px không lấy focus (bàn phím đang mở không sập, chưa mở thì không bật). `suffix` là đơn vị mờ
`aria-hidden` (nhãn vẫn ghi đơn vị). Độ rộng khi có `stepper` / `suffix` truyền qua `wrapperClassName`.
`ThousandHint` nay chữ 13 px, vùng chạm 44 px.

### 1.8 Ngày giờ (M6)

```js
import { formatDateShort, formatTimeShort } from "../../utils/formatters";
formatDateShort("2026-11-04"); // "T4, 04/11"   (cùng năm)
formatDateShort("2025-12-15"); // "15/12/2025"  (khác năm)
formatTimeShort(bp.paid_at); // "21:13"
```

Đọc `YYYY-MM-DD` (và nửa đêm UTC `…T00:00:00.000000Z` của cast `date`) theo ngày lịch, không lệch ngày vì UTC.
Không dùng "Hôm nay" / "Hôm qua".

### 1.9 Biểu tượng đã thêm (`icons.jsx`, đường vẽ Lucide)

`ChevronRight`, `ChevronUp`, `Minus`, `SlidersHorizontal`, `CircleCheck`, `RotateCcw`, `Eye`, `EyeOff`,
`File`, `Share`, `Copy` — quét SVG trong 7 bản đề xuất, đây là mọi biểu tượng các bản dùng mà `icons.jsx`
chưa có (cộng `Share` cho quyết định 11 và `Copy` cho "Copy kết quả" của 07).

## 2. Chỗ chệch bản vẽ và lý do

| # | Bản vẽ / đề xuất | Triển khai | Lý do |
| --- | --- | --- | --- |
| 1 | Nút "Lọc" ở cuối hàng chip (A1, M4) | Ghim **trái**, nằm ngoài vùng cuộn (`.chip-bar` = `.chip` Lọc + `.chip-row`) | PM chốt (tổng hợp 3.3): ở 360 px nút cuối bị đẩy ra ngoài màn |
| 2 | M3b chưa vẽ cụ thể | `.list-row-split` + `.list-row-main` + `.list-row-action` (≥ 84×44, có chữ) | PM chốt kiểu nhóm 04 (tổng hợp 3.2) |
| 3 | Mục 8: đổi bộ class mặc định của `CurrencyInput` / `NumberInput` / `DatePicker` sang `field-input`, hậu tố ₫ mặc định | **Không đổi mặc định**; hậu tố là prop `suffix` tùy chọn | PM: "mặc định giữ hành vi cũ"; đổi mặc định làm cao / rộng ô ở màn của nhóm khác (lưới thẻ người chơi, thuê xe) ngoài tầm kiểm của đợt 0 |
| 4 | Biểu tượng app trên thanh màn gốc (không nói là link) | Chỉ trang trí, không phải link về "/" | Tab "Bill cầu" đã là trang chủ; bớt một điểm dừng Tab; thanh desktop vẫn có link logo như cũ |
| 5 | FAB `active:scale-95` | Chỉ đổi màu khi bấm | `.fab-enter` giữ `transform` cuối của animation (`fill-mode: both`) nên scale không chạy |
| 6 | Vùng chạm chip: khung tím đứt trong bản vẽ | `::after` `inset: -4px 0`, hàng chip có `py-1 -my-1` để vùng chạm không bị cắt khi cuộn ngang | `overflow-x: auto` cắt cả chiều dọc |
| 7 | `data-keyboard="open"` ẩn tab / FAB "trên trình duyệt co cả khung bố cục (Firefox Android)" | Có đặt, nhưng công thức `innerHeight − vv.height − vv.offsetTop` chỉ phát hiện được bàn phím **phủ lên** (iPhone, Chrome Android ≥ 108); trình duyệt co khung bố cục cho ra 0 | Giới hạn của `visualViewport`; ghi lại, cần thử máy thật |
| 8 | Tên file khe thanh trên `ui/appBarSlot.js`; component `ui/AppBar.jsx` + PageHeader prop `menu` | `ui/appBarContext.js` (context `{ slot, register }`); PageHeader thêm `menu`, `menuTitle`, `barAction`, `hideTabBar` | Đặt tên theo nội dung; `barAction` là "khe nút phải" của A1, `hideTabBar` theo yêu cầu "màn tự ẩn tab không sửa Layout" |
| 9 | `.list-row-*` (title, sub, end, child, warn) | Thêm `.list-row-text`, `.list-row-chevron`, `.list-row-panel` (M3c), `.amount` / `.amount-lg` (M7) | Đủ để nhóm không phải tự viết lại kiểu chữ / số tiền |
| 10 | Thông báo lỗi chỉ ghi "nút đóng" | Nút đóng chỉ có ở thông báo lỗi; thành công / thông tin tự tắt, không nút | Đúng mục 6 bảng "Kiểu"; giữ thông báo thành công gọn |
| 11 | Màn "Đang tải" có tên app ngay dưới biểu tượng | "Đang tải..." thành dòng nhỏ kèm vòng quay dưới "Sổ cầu lông" | Theo mockup mục 10 |
| 12 | `EmptyState` lỗi tải có nút "Thử lại" do màn truyền | Thêm prop `onRetry` dựng sẵn nút "Thử lại" (kèm `RotateCcw`) | Mọi màn cùng một nút, khỏi chép |
| 13 | Đầu nhóm M10 chỉ vẽ điện thoại | Desktop dính dưới thanh `h-16` (`top: 4rem`), bỏ lề âm | Không vỡ nếu nhóm dùng M10 cả desktop |
| 14 | Giả thuyết dấu "," trên iPhone (mục 2, dòng 13) | Không đổi `NumberInput` (`type="number"`) | Đề xuất ghi "chỉ sửa sau khi thử máy thật" |

## 3. Chữ phát sinh

Ngoài danh sách đã gật ("Về trang chủ", "Thao tác khác", "Hiện mật khẩu" / "Ẩn mật khẩu", mẫu "Lọc (N)"):

| Chữ | Ở đâu | Ghi chú |
| --- | --- | --- |
| "Bớt 1" / "Thêm 1" | `aria-label` mặc định của nút −/+ (`NumberInput stepper`) | Chỉ dùng khi màn quên truyền `decrementLabel` / `incrementLabel`; nhóm 07 truyền chữ đã gật ("Bớt 1 ngày"…) |

Chữ cũ dùng lại ở chỗ mới (không phải chữ mới): nhãn nút ‹ dự phòng "Danh sách bill cầu", "Danh sách bill
tiệc" (tên mục menu), "Về chi tiết Bill", "Về chi tiết" (nhãn quay lại của màn sửa); "Thử lại", "Đóng",
"Sổ cầu lông", "Đang tải...", "Tài khoản", "Thêm", "Đăng xuất". Tiêu đề màn gốc trên thanh = tiêu đề
`PageHeader` của màn (đổi sang nhãn tab theo quyết định 4 là việc của từng nhóm trong file của mình).

## 4. Kiểm chứng

Cổng theo spec mục 5, chạy trong `FRONTEND` ngày 05/11/2026:

| Cổng | Kết quả |
| --- | --- |
| `npm test` | 8 file, **94 passed**, 0 failed (trước đợt: 69) — thêm test `formatDateShort`, `formatTimeShort`, màn đẩy vào / nút quay lại dự phòng / tiêu đề mặc định (`navItems`), `keyboardInset`, `numberStep` |
| `npx eslint .` | **3 lỗi + 8 cảnh báo**, đúng bằng mốc đo trên `main` d438adb (cùng các file, không file nào của đợt này thêm lỗi) |
| `VITE_API_URL=/api npx vite build` | ok (cảnh báo chunk > 500 kB có sẵn) |
| `git diff --stat 51fd830` | 31 file, chỉ chỗ cần đổi; file sửa bằng script để không format lại cả file |
| Ảnh bill xuất | bill cầu #179 (25 người, bill con #180, nợ cũ) và bill tiệc #25 (28 người): xuất ở 1280 và 390, so với bản build `main` cùng máy chủ giả — **trùng từng byte, 0 điểm ảnh khác** |
| Desktop 1280 so với `main` | 9 màn chụp cả trang: 0 điểm ảnh khác, trừ đăng nhập (nút mắt mới, 130 px) và 2 px ở góc bo một khung Dashboard — 2 px này cũng lệch giữa hai lần chụp chính bản `main` (nhiễu kết xuất) |

Ảnh (máy chủ giả `tools/mock-server.mjs`, cổng 4100; không chạm máy chủ thật), thư mục `/private/tmp/claude-501/-Users-admin-Desktop-Github-APACTech-BadmintonNew/0c1bebe2-0704-4215-bcf9-7308f4798c3d/scratchpad/trien-khai/01-khung-app/`:

- `anh/route-390/` — **mọi route** ở 390, tài khoản 7 mục: một thanh duy nhất, màn đẩy vào có ‹, không màn nào mất đường quay lại.
- `anh/khung/` — khung trang 360 / 390 / 430 / 640 / 768 / 1024 / 1280, tài khoản 7 mục (`admin-*`) và 2 mục (`limited-*`).
- `anh/trang-thai/` — đang tải, mất kết nối, đăng nhập (thường, sai mật khẩu + hiện mật khẩu), không có quyền
  (+ "Về trang chủ"), sheet "Thêm" / "Tài khoản", màn chi tiết đang tải (nút ‹ dự phòng) — 360 / 390 / 430 (+ 1280).
- `anh/rong/` — danh sách rỗng ở 390.
- `anh-mau/` — trang mẫu ngoài repo (`mau/`) dựng mọi class / component M2–M17 vì chưa màn nào dùng: hàng,
  chip, ô tóm tắt, menu, lỗi tại ô, −/+, thông báo trên tab / FAB / ActionBar, sheet cao cố định, ConfirmDialog
  busy — 360 / 390 / 430 / 1280.
- `anh/xuat/` — ảnh bill xuất của nhánh (`nhanh/`) và `main` (`main/`); `anh/so-main/` — desktop hai bản.

Chưa kiểm được (cần máy thật): sheet nâng trên bàn phím iOS / Android, `data-keyboard`, giả thuyết dấu "," của
`NumberInput` trên iPhone vùng VN, app cài ra màn hình chính (vùng an toàn trên / dưới).

## 5. Quyết định tự chọn

- **Cơ chế thanh trên**: `PageHeader` (và `AppBar`) đưa nội dung vào khe của Layout bằng `createPortal`, chỉ báo
  hai cờ nguyên thủy (`pushed`, `hideTabBar`) qua `register` trong `useLayoutEffect`. Lý do: 14 màn đang có
  `PageHeader` tự lên thanh ngay, không phải sửa từng màn (trạng thái trung gian không vỡ); tiêu đề là node
  React nằm trong cây của màn nên cập nhật theo màn, không setState node từ con lên cha (không vòng lặp render);
  context bọc riêng `children` nên Layout không phải thụt lề lại cả file.
- Hai `<header>`: thanh điện thoại `.app-bar` (`sm:hidden`) và header desktop cũ (`hidden sm:block`, nội dung
  giữ nguyên).
- File phụ mới cạnh file của nhóm 01: `common/InputSuffix.jsx`, `common/selectAllOnFocus.js`,
  `ui/appBarContext.js`, `ui/toastContext.js`, `ui/useToast.js`, `ui/useKeyboardInset.js`; hàm thuần
  `utils/keyboardInset.js`, `utils/numberStep.js` (+ test).
- `ActionBar`, `useToast` chưa được màn nào gọi trong đợt 0 (là API cho đợt 1; đã dựng và chụp ở trang mẫu).

## 6. Điều đợt 1 cần biết

- Tiêu đề màn gốc trên thanh = `title` của `PageHeader` trong file của nhóm → đổi sang nhãn tab (quyết định 4)
  là việc của 02, 05, 06, 07. Đến lúc đó thanh vẫn hiện tiêu đề cũ ("Danh sách Bills"…).
- Màn đã có `back` thì trên điện thoại link "‹ …" trong nội dung tự ẩn; đừng tự vẽ thêm nút quay lại.
- Thanh tab nay 56 px gồm viền (trước 57): FAB / thanh dính đáy viết cứng `4.25rem` / `4rem` sẽ cách tab
  12 / 8 px tới khi chuyển sang `.fab` / `ActionBar overTab` (Dashboard.jsx:1581, PartyBills.jsx:966,
  CarRentalCalculator.jsx:1120 — file của 02, 05, 07).
- Màn chi tiết bill cầu / tiệc đã ẩn tab: 04 / 05 nên đưa nút chính xuống `ActionBar`, thao tác phụ vào `menu`.
- Tooling dùng chung: `/private/tmp/claude-501/-Users-admin-Desktop-Github-APACTech-BadmintonNew/0c1bebe2-0704-4215-bcf9-7308f4798c3d/scratchpad/trien-khai/tools/README.md` (mỗi nhóm một cổng 4102–4107, dựng bản build của nhánh mình rồi
  `node mock-server.mjs --dist … --port …`).

## 7. Thấy khi làm, ngoài phạm vi (không sửa)

- Màn chi tiết bill, Dashboard với tài khoản chỉ có quyền xem vẫn hiện nút Xóa / Bill con / Gửi Telegram
  (`BillDetail.jsx`, `Dashboard.jsx`) — quyết định 10, nhóm 02 / 04.
- `BillDetail.jsx` khi bill không tồn tại tự chuyển về danh sách (sau `alert`) nên ít khi thấy khối lỗi của màn.
- `CurrencyInput.jsx:40` — lỗi ESLint `set-state-in-effect` có sẵn (nằm trong mốc), chưa sửa.
