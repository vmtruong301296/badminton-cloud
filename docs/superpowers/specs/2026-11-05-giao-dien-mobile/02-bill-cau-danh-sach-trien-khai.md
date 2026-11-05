# 02 Bill cầu: danh sách — triển khai (đợt 1, phương án A)

Ngày: 2026-11-05 · Nhánh `feature/mobile-02-danh-sach` (tách từ `91fd4a4`) · Spec: `../2026-11-05-giao-dien-mobile-design.md` ·
Đề xuất: `02-bill-cau-danh-sach-de-xuat.html` (phương án A) · Chủ dự án duyệt hướng 05/11/2026.

Chỉ frontend. Không đổi route, quyền, API, cách tính tiền. Desktop từ 1024 px giữ bố cục; thay đổi trên desktop chỉ là
những chỗ spec cho phép (tiêu đề "Bill cầu", "Đã trả hết" có hỏi lại, sheet Thống kê dùng chung) và hai trạng thái mới
(lỗi tải, "Xóa lọc" khi lọc ra rỗng).

## 1. Đã làm

| Phần                        | Điện thoại (dưới md 768 px)                                                                                                                                                                           | Máy tính bảng 768–1023                             | Desktop ≥ 1024                          |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------- |
| Đầu màn                     | "Bill cầu" trên thanh trên + nút biểu tượng Thống kê (`barAction`); bỏ dòng "N bills hiển thị"                                                                                                        | "Bill cầu" + dòng đếm + Thống kê / Tạo Bill như cũ | như cũ, tiêu đề "Bill cầu"              |
| Tóm tắt (M11)               | 2 ô "Còn phải thu" / "Cầu khả dụng" → sheet                                                                                                                                                           | như điện thoại                                     | (cột phải như cũ)                       |
| Lọc (M4, M5)                | `.chip-bar`: "Lọc" ghim trái (số đếm khi lọc ngày) → sheet "Lọc bill"; chip khoảng ngày có ✕; chip 1 phần / Chưa TT / Đã TT                                                                           | thanh lọc cũ                                       | thanh lọc cũ                            |
| Danh sách                   | nhóm theo tháng, đầu nhóm dính (M10); hàng M3 64 px, không Xóa, không ›; bill con ngay dưới; bill con mồ côi có hiện; "Xem thêm" 10 bill / lần                                                        | bảng cũ + phân trang                               | bảng cũ + phân trang                    |
| DS chưa thanh toán          | sheet: hàng mở tại chỗ (M3c) → ngày thiếu (M6, chạm mở bill) + "Đã trả hết"                                                                                                                           | sheet                                              | thẻ cột phải; ô tick → nút "Đã trả hết" |
| "Đã trả hết"                | `ConfirmDialog` (busy) → kết quả hiện trong sheet                                                                                                                                                     | như điện thoại                                     | `ConfirmDialog` → thông báo ngắn (M8)   |
| Cầu khả dụng                | sheet: tổng, cảnh báo dưới 10 ống, từng loại, "Nhập kho" (quyền `shuttles.view`)                                                                                                                      | sheet                                              | thẻ cột phải như cũ                     |
| Rỗng / lỗi / đang tải (M13) | khung chờ theo hình hàng mới; lỗi tải có "Thử lại"; lọc ra rỗng có "Xóa lọc"                                                                                                                          | lỗi / rỗng như điện thoại, khung chờ bảng cũ       | như máy tính bảng                       |
| FAB (M9)                    | `.fab` (cách tab 16 px, nội dung tự chừa đáy)                                                                                                                                                         | `.fab`                                             | không có (md:hidden)                    |
| Thống kê                    | Tháng / Năm + `PeriodStepper` ‹ › (M12); 2 ô số chạm để đổi biểu đồ; 1 biểu đồ; nhãn 12 px; trục số tròn; 10 người đầu + "Xem đủ"; bỏ khối "Tổng ống cầu"; **không theo bộ lọc ngày** (quyết định 13) | như điện thoại, 2 biểu đồ từ 768                   | 2 ô số chỉ đọc + 2 biểu đồ cạnh nhau    |
| Báo lỗi                     | `alert()` xóa bill / đánh dấu → thông báo ngắn có "Thử lại" (hoặc khối trong sheet)                                                                                                                   |                                                    |                                         |

Hàm thuần mới (viết test trước): `utils/billList.js` (trạng thái, quá hạn, bộ lọc trạng thái, còn thiếu theo bill,
hàng cấp ngoài + bill con mồ côi, nhóm tháng, cắt "Xem thêm", khoảng ngày nhanh, nhãn chip ngày, DS chưa thanh toán
chuyển từ Dashboard ra), `utils/shuttleStock.js` (in tồn cầu, chuyển từ Dashboard ra), `utils/chartAxis.js` (đỉnh trục),
thêm `periodSummary` / `shiftMonthKey` / `formatMonthLabel` / `availableYears` vào `utils/monthlyStats.js`.

Component mới (`components/dashboard/`): `MobileBillList`, `DashboardSummary`, `BillFilterSheet`,
`UnpaidPlayersSheet`, `ShuttleStockSheet`, `StatsSheet`; `components/ui/PeriodStepper.jsx` (M12, dùng chung).

## 2. API cho nhóm khác dùng lại

### `ui/PeriodStepper.jsx` (M12)

```jsx
import PeriodStepper from "../../components/ui/PeriodStepper";

<PeriodStepper
  label="Tháng 11/2026" // nhãn giữa, đọc lại khi đổi (aria-live)
  onPrev={() => setMonth(shiftMonthKey(month, -1))}
  onNext={() => setMonth(shiftMonthKey(month, 1))}
  prevLabel="Tháng trước" // aria-label nút ‹ (bắt buộc)
  nextLabel="Tháng sau" // aria-label nút › (bắt buộc)
  prevDisabled={false}
  nextDisabled={month >= currentMonth} // › mờ ở kỳ mới nhất
  className="w-full sm:w-auto" // bố cục: điện thoại cả hàng, desktop gọn
/>;
```

Hai nút `btn btn-secondary btn-icon` (44 px điện thoại, 40 px từ sm), nhãn `min-w-[8.5rem]` để nút không nhảy khi
nhãn đổi độ dài. Component chỉ vẽ: màn tự tính kỳ và khi nào tắt nút. Hàm kỳ có sẵn trong `utils/monthlyStats.js`:
`shiftMonthKey("2026-01", -1) === "2025-12"`, `formatMonthLabel("2026-09") === "Tháng 9/2026"`,
`availableYears(bills, 2026)` (năm có bill + năm nay, mới → cũ; dùng cho ‹ › theo năm).

### Hàm thuần dùng được cho bill tiệc (05) / thuê xe (07)

- `utils/billList.js`: `groupEntriesByMonth(entries)` cần `entries = [{ bill: { id, date }, children: [] }]` — nhóm
  theo `date.slice(0, 7)`; `unpaidTotal` tính theo `bill_players` kiểu bill cầu (05 cần hàm còn thiếu riêng).
  `takeEntries(groups, n)` cắt "Xem thêm" giữ số liệu đầu nhóm cả tháng. `monthRange(now, 0 | -1)`,
  `dateRangeLabel(from, to)` cho chip "Tháng này / Tháng trước" và chip khoảng ngày.
- `utils/chartAxis.js`: `niceAxisMax(max)` — đỉnh trục tròn, vạch giữa luôn là số nguyên.
- `utils/shuttleStock.js`: `formatShuttleStock(balls)` ("15 ống + 6 quả (186 quả)"), `formatTubes(balls)`
  ("3 ống + 2 quả"), `LOW_STOCK_TUBES` / `LOW_STOCK_BALLS` — 06 (loại cầu) in tồn kho có thể dùng chung.

## 3. Chỗ chệch bản vẽ và lý do

| #   | Bản vẽ (A)                                                                | Triển khai                                                                                                                                                | Lý do                                                                                                                                                                                                |
| --- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Dòng "Bill cầu" + nút "Thống kê" trong nội dung, dưới thanh "Sổ cầu lông" | Tiêu đề trên thanh trên, Thống kê là nút biểu tượng 44 px trên thanh (`barAction`, `aria-label="Thống kê"`)                                               | Quyết định 2 / tổng hợp 3.1 (gộp thanh trên); đúng ví dụ trong bàn giao đợt 0                                                                                                                        |
| 2   | Hai ô tóm tắt chung một khung, vạch chia giữa                             | Hai `.stat-tile` rời, cách 8 px                                                                                                                           | Dùng class chung M11 của đợt 0, không tự vẽ khung riêng                                                                                                                                              |
| 3   | Bill quá hạn: vạch hồng mép trái                                          | Như bản vẽ (vạch 4 px bằng `shadow-[inset_4px_0_0_…rose-500]`), **không** dùng `.list-row-warn` (tô hồng cả hàng)                                         | Chủ dự án duyệt "không tô hồng cả hàng" (8 ý của A). Đề xuất PM: đổi `.list-row-warn` thành vạch trái để các nhóm dùng chung                                                                         |
| 4   | Toast "Đã đánh dấu {tên} trả hết" ở đáy sheet                             | Điện thoại / máy tính bảng: khối xanh `role="status"` ở đầu sheet DS chưa thanh toán (lỗi: khối hồng `role="alert"` + "Thử lại"); desktop: thông báo ngắn | Thông báo ngắn của đợt 0 nằm dưới lớp nền mờ của sheet (z-40 < z-50); quy tắc đợt 0: lỗi khi đang mở sheet thì hiện trong sheet. Focus chuyển vào khối này vì nút vừa bấm biến mất cùng người đã trả |
| 5   | Dòng phụ bill con mồ côi "#167 · của #166 · 2/5 người chưa TT"            | "#166 · 2/5 người chưa TT · của #165"                                                                                                                     | Ở 360–390 px dòng bị cắt "…": để phần ít quan trọng nhất ở cuối                                                                                                                                      |
| 6   | Hàng không có › (bản vẽ) — bàn giao đợt 0 có `.list-row-chevron`          | Không có › trên hàng bill; hàng người trong sheet có ˅ (M3c)                                                                                              | Ở 360 px › chiếm 28 px làm cắt "người chưa TT"; bản vẽ được duyệt không có ›                                                                                                                         |
| 7   | Số "Còn phải thu" 20 px                                                   | 18 px dưới 400 px, 20 px từ 400 px                                                                                                                        | Ô rộng ~160 px ở 360: "38.250.000 ₫" 20 px tràn qua mép                                                                                                                                              |
| 8   | Ô số Thống kê có chấm tròn                                                | Có chấm (xanh = đang chọn) + viền emerald của `.stat-tile[aria-pressed]`; desktop ô chỉ đọc, không chấm                                                   | Như D1                                                                                                                                                                                               |
| 9   | Breakpoint: bản vẽ chỉ nói "điện thoại"                                   | Danh sách / chip / "Xem thêm" dưới **md** (768); ô tóm tắt + sheet dưới **lg** (1024); thanh lọc cũ từ md (trước: từ sm)                                  | Đúng mục "Desktop" của bản đề xuất (`md:hidden` cho thẻ, `lg:hidden` cho ô tóm tắt); ở 640–767 thanh lọc cũ (có "Số bill / trang") không còn điều khiển danh sách thẻ                                |
| 10  | —                                                                         | Khối mô tả / nút của `PageHeader` ẩn trên điện thoại nên nội dung kéo lên `-mt-3.5`                                                                       | `PageHeader` vẫn dựng khung `mb-3` khi `description` / `actions` chỉ hiện từ sm. Đề xuất PM: `PageHeader` bỏ khung khi mọi con ẩn trên điện thoại (prop hoặc tự kiểm)                                |

## 4. Quyết định tự chọn

- **"Xóa lọc"** trong sheet Lọc chỉ bỏ khoảng ngày (sheet chỉ chứa ngày, chip trạng thái ở ngoài); "Xóa lọc" ở trạng
  thái rỗng bỏ mọi bộ lọc như nút "Xóa bộ lọc" cũ (`status: []`).
- Rỗng **vì lọc** (đang lọc ngày, hoặc lọc trạng thái mà vẫn còn bill bị lọc ra) → "Xóa lọc"; **thật sự** chưa có bill →
  "Tạo bill đầu tiên" như cũ. Áp cả desktop (cùng một khối).
- Lỗi tải danh sách (mới): cả desktop và điện thoại hiện `EmptyState tone="error"`; ẩn ô tóm tắt (cùng dữ liệu).
- **Thống kê không theo lọc ngày**: không lọc ngày và danh sách tải được → dùng lại dữ liệu đã có; đang lọc ngày (hoặc
  danh sách lỗi) → khi mở sheet gọi thêm `billsApi.getAll()` không tham số, có khung chờ và lỗi tải riêng.
- Kỳ thống kê lọc theo chuỗi ngày `YYYY-MM` / `YYYY` (như biểu đồ có sẵn) thay vì `new Date()` giờ máy: ô số, biểu đồ,
  tổng cầu, tổng người luôn khớp nhau; giờ Việt Nam ra cùng kết quả.
- ‹ tháng không giới hạn (như ô chọn tháng cũ); › tắt ở tháng hiện tại. Theo năm: ‹ › chỉ qua các năm có bill.
- "Xem thêm": đếm **hàng cấp ngoài** (bill chính + bill con mồ côi); bill con dưới bill chính đi kèm. Sau "Xem thêm",
  focus chuyển tới hàng mới đầu tiên. Đổi bộ lọc thì về 10.
- Thứ tự chip trạng thái điện thoại theo bản vẽ (1 phần, Chưa TT, Đã TT); desktop giữ thứ tự cũ.
- Đầu nhóm tháng tính số liệu **cả tháng** (không chỉ phần đang hiện), nên không đổi khi bấm "Xem thêm".
- Ngày thiếu trong sheet mở **bill chính** của ngày đó (ngày chỉ có bill con thì mở bill con).
- Bill không có quyền `bills.view`: hàng / ngày thiếu là `div`, không bấm được (như cũ).
- Lỗi xóa bill (desktop): đóng hộp xác nhận rồi mới báo (thông báo nằm dưới lớp nền mờ của hộp), "Thử lại" gọi lại lệnh xóa.

- **Sửa lỗi có sẵn trong file của nhóm** (cần cho sheet Lọc): `loadBills` không bỏ kết quả cũ, nên đổi Từ ngày rồi
  Đến ngày nhanh thì lần tải trước (nhiều bill hơn, về sau) đè lên lần sau — chụp ảnh thấy danh sách 01/01–15/01 vẫn
  hiện bill tháng 10/11. Nay chỉ nhận kết quả của lần tải mới nhất (`loadSeqRef`).
- Desktop: sau "Đã trả hết", nút vừa bấm biến mất cùng người đó nên focus rơi về `body` (Tab tiếp tính từ đầu
  trang); thông báo ngắn vẫn được đọc nhờ vùng `role="status"` của đợt 0. Trong sheet điện thoại thì focus chuyển vào khối kết quả.

## 5. Chữ phát sinh ngoài danh sách đã duyệt

| Chữ                                                                                  | Ở đâu                                                                                        | Ghi chú                                                                                              |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| "Không tải được thống kê"                                                            | Tiêu đề lỗi tải trong sheet Thống kê (kèm "Kiểm tra mạng rồi thử lại." + "Thử lại" đã duyệt) | Câu đã duyệt "Không tải được danh sách bill" lạ ở trong sheet Thống kê                               |
| `aria-label` "Đã trả hết: {tên}"                                                     | Nút "Đã trả hết" của từng người (thẻ desktop và sheet)                                       | Nhiều nút cùng chữ: trình đọc màn hình cần biết của ai; tên bắt đầu bằng chữ hiện trên nút           |
| `aria-label` hàng: thêm ", {nhãn trạng thái}" cuối; bill con mở đầu "Bill con #{id}" | Hàng bill điện thoại                                                                         | Mẫu đã duyệt "Bill #{id}, {ngày}, {tiền}, {a}/{b} người chưa TT" bỏ mất nhãn "Quá hạn" / "TT 1 phần" |

Chữ cũ dùng lại ở chỗ mới: "Tất cả đã thanh toán" (dòng phụ khi không ai nợ), "Tổng:", "Đang tải...", "Chưa có loại
cầu", "Không có loại cầu nào còn tồn kho", "Không có người chơi nào chưa thanh toán", "Năm {yyyy}", "Thống kê", "Lọc (1)"
(mẫu của đợt 0). Chữ bỏ trên điện thoại: chú thích màu, "Số bill / trang", "Chi tiết ›", "Tổng ống cầu" / "* 1 ống cầu = 12 quả"
(bỏ ở cả desktop — số đã nằm ở ô "Số cầu").

## 6. Kiểm chứng

Cổng theo spec mục 5, chạy trong `FRONTEND` ngày 05/11/2026:

| Cổng | Kết quả |
| --- | --- |
| `npm test` | 11 file, **129 passed**, 0 failed (trước: 94) — thêm `billList.test.js` (22), `shuttleStock.test.js`, `chartAxis.test.js`, 8 ca mới trong `monthlyStats.test.js` |
| `npx eslint .` | **3 lỗi + 8 cảnh báo**, bằng mốc `91fd4a4`; cảnh báo có sẵn `Dashboard.jsx` (`loadBills` thiếu trong deps) vẫn là cái cũ, không thêm |
| Build (`VITE_API_URL=/api`, `tools/vite.no-repo-write.config.mjs`) | ok (cảnh báo chunk > 500 kB có sẵn) |
| `git diff --stat 91fd4a4` | chỉ file của nhóm 02 (+ doc này); `Dashboard.jsx` sửa bằng script, không format lại cả file |
| Desktop so với `91fd4a4` | cùng máy chủ giả + dữ liệu, chụp cả trang 1024 và 1280: khác **chỉ** ở tiêu đề và thẻ "DS chưa thanh toán" (ô tick → nút "Đã trả hết", tên + tiền không còn chừa chỗ ô tick); bảng, thanh lọc, thẻ Cầu khả dụng trùng từng điểm ảnh |

Việc chính (điện thoại 390 px, dữ liệu máy chủ giả):

| Việc | Trước | Sau |
| --- | --- | --- |
| Tìm bill tháng trước còn nợ rồi mở | cuộn + đọc ngày ISO từng hàng 91 px; lọc ngày ≈ 8 chạm + 2 ô | đầu nhóm "Tháng 10/2026 · 6 bill · còn thiếu …" thấy ngay khi cuộn → 1 chạm; hoặc Lọc → Tháng trước → Xem 6 bill → hàng = **4 chạm, 0 ô** |
| Xem số bill / số cầu tháng này | Thống kê + đọc nhãn 10 px trên cột + cuộn ~1 màn tới "Tổng số lượng cầu" | biểu tượng Thống kê → hai ô "Số bill 3" / "Số cầu 96 · 8 ống" ở đầu sheet: **1 chạm, 0 cuộn** |
| Đánh dấu một người trả hết | cuộn ~1.700 px + 1 chạm ô tick, không hỏi | ô Còn phải thu → tên → Đã trả hết → xác nhận = 4 chạm, có hỏi lại |

Ảnh (máy chủ giả `tools/mock-server.mjs` cổng 4102 + `fixtures-02.mjs`, không chạm máy chủ thật), thư mục
`/private/tmp/claude-501/-Users-admin-Desktop-Github-APACTech-BadmintonNew/0c1bebe2-0704-4215-bcf9-7308f4798c3d/scratchpad/trien-khai/02-bill-cau-danh-sach/anh/`:

- `admin/` — 360 / 390 / 430 / 1280 (+ 768, 1024): màn đầu, cả trang, đầu nhóm dính, cuối danh sách + "Xem thêm";
  `x-thang-truoc-*` (việc chính 1: sheet Lọc → Tháng trước → danh sách tháng 10 → mở bill), `x-thong-ke-*` (việc chính
  2: tháng này, chạm "Số cầu", tháng trước, theo năm, người chơi, "Xem đủ"), `x-tra-het-*` (sheet → mở người → hỏi lại →
  kết quả; desktop: thông báo ngắn), `x-cau-*`, `x-loc-rong-*` ("Xóa lọc").
- `limited/` — tài khoản chỉ `bills.view` + `party_bills.view`: không FAB, không "Đã trả hết", không "Nhập kho".
- `het-cau/` — tồn 100 quả: ô Cầu khả dụng hồng "8 ống · Cần nhập thêm", sheet có cảnh báo.
- `loi/` — lỗi tải danh sách (ẩn ô tóm tắt, "Thử lại"), Thống kê lỗi khi đang lọc ngày (`x-thong-ke-loi-*`).
- `rong/` — dữ liệu rỗng: "Chưa có bill nào" + "Tạo bill đầu tiên", Thống kê toàn 0.
- `so-base/` — desktop nhánh và `91fd4a4` cùng dữ liệu + ảnh khác biệt (`diff-1024.png`, `diff-1280.png`).

Dữ liệu khó có trong ảnh: tên ~30 ký tự (sheet DS chưa thanh toán, Thống kê), bill 25 / 28 người, bill 38.250.000 ₫,
số lẻ làm tròn nghìn, 34 người còn nợ / 15 triệu, bill con mồ côi (#166 của #165), nợ cũ (cột "Tiền nợ" ở màn chi tiết).

Chưa kiểm được: thao tác trên máy thật (cuộn đầu nhóm dính trên iOS Safari, ô ngày gốc của trình duyệt trong sheet Lọc).

## 7. Thấy khi làm, ngoài phạm vi (không sửa)

- `Dashboard.jsx` `handleMarkPlayerPayment`: gửi song song `markPayment` từng bill; một bill lỗi thì các bill khác đã
  đổi nhưng giao diện không tải lại (cùng loại lỗi 6.11 của bill tiệc).
- `Dashboard.jsx` hộp xác nhận xóa bill chưa dùng `busy` → bấm "Xóa" 2 lần gửi 2 lệnh (lỗi 6.12, có sẵn).
- Giả thuyết nợ cũ cộng 2 lần (tổng hợp 6.3) vẫn nguyên: `collectUnpaidPlayers` giữ đúng công thức cũ
  (`total_amount + debt_amount`), kể cả nhánh `debt_details` mà `GET /api/bills` không trả (giữ để không đổi hành vi).
- `components/ui/ToastProvider.jsx` / `index.css`: vùng thông báo z-40 dưới `Modal` z-50 → không báo được từ trong sheet;
  mỗi nhóm sẽ tự vẽ khối báo trong sheet. Đề xuất PM: một khối báo dùng chung cho sheet (hoặc lớp thông báo trên modal).
- `screens/bills/BillDetail.jsx` (nhóm 04): đầu màn chi tiết vẫn in ngày ISO "2026-10-30" (thấy khi chụp luồng mở bill).
