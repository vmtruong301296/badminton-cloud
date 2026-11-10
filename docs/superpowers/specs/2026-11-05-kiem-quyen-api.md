# Kiểm quyền API ở backend

Ngày: 2026-11-05
Nhánh: `fix/kiem-quyen-api` (tách từ `main` 6557874). Chưa merge, chưa deploy.
Trạng thái: chờ chủ dự án duyệt mục 4 ("Cần chủ dự án quyết").

## 1. Vấn đề và cách sửa

Trước đây mọi route trong `routes/api.php` chỉ có middleware `auth`, cả 26 FormRequest
`authorize()` đều `return true`, không có Gate / Policy. Frontend chỉ ẩn nút. Tài khoản
nào đăng nhập được (kể cả người chơi tạo nhanh, không có vai trò) cũng gọi thẳng API để
xóa bill, sửa tài khoản người khác hay tự gán vai trò admin.

Cách sửa:

- Middleware `App\Http\Middleware\RequirePermission`, alias `permission`, đăng ký trong
  `bootstrap/app.php`. Khai báo `permission:a|b` = có **một trong** các quyền là qua
  (dùng `User::hasAnyPermission`). Viết trong route qua `RequirePermission::any('a', 'b')`.
- Gắn vào **từng route** (86 route trong nhóm `auth`). `login`, `logout`, `me`,
  `images/{path}` giữ nguyên.
- Thiếu quyền: **403** JSON `{"message": "Bạn không có quyền thực hiện thao tác này."}`.
  Chưa đăng nhập: vẫn **401** như cũ (middleware `auth` chạy trước).
- Không thêm quyền, không migration, không sửa dữ liệu quyền. FormRequest giữ nguyên.

**Chữ mới (hiện cho người dùng):** "Bạn không có quyền thực hiện thao tác này." — thông
điệp 403 của mọi API. Màn nào hiện `error.response.data.message` sẽ hiện câu này (vd hộp
lỗi màn Xếp bảng, `alert` màn Người chơi); các màn khác hiện chữ lỗi chung đã có.

## 2. Nguyên tắc chọn quyền

1. Route ghi dùng quyền cùng tên (`bills.delete` cho `DELETE /bills/{id}`…).
2. Route được một màn gọi thì cho quyền dùng để vào màn đó (App.jsx `ProtectedRoute`,
   `MasterRouteGuard`, `HomeRedirect`) hoặc quyền mà màn kiểm trước khi hiện nút
   (`hasPermission`). Route đọc dùng chung nhiều màn: "có một trong các quyền".
3. Nút **không kiểm quyền** trên một màn: giữ (nới quyền) khi thao tác chỉ thêm bản ghi
   không có quyền gì hoặc chỉ đụng dữ liệu của chính người gọi; **không** nới khi việc
   nới cho phép chiếm tài khoản, đổi tài khoản nhận tiền, xóa / sửa dữ liệu dùng chung —
   những chỗ này ghi ở mục 4.2.
4. Route frontend không gọi: theo tên quyền, chọn quyền hẹp nhất (mục 4.3).

Nhóm quyền dùng lại trong `routes/api.php`:

- `$masterTabs` = `ratios.view | menus.view | shuttles.view | payment_accounts.view` —
  màn Master (`/master`) mở cho ai có một trong bốn quyền này và hiện **cả 4 tab**
  (`MasterManagement.jsx:8-13`), mỗi tab gọi `GET` danh sách của mình.
- `$billForms` = `bills.create | bills.update` — màn tạo / sửa bill cầu.
- `$partyBillForms` = `party_bills.create | party_bills.update` — màn tạo / sửa bill tiệc.

## 3. Bảng route → quyền

Đường dẫn bỏ tiền tố `/api`. "Nới" = có quyền ngoài nhóm quyền cùng tên, xem mục 4.1.

### Người chơi

| Route                      | Quyền (một trong)                                             | Màn gọi / lý do                                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /players`             | `users.view`, `$billForms`, `$partyBillForms`                 | Người chơi (`users.view`, `PlayersManagement.jsx:55`); chọn người trong tạo / sửa bill (`PlayerSelector.jsx:68`) và bill tiệc (`CreatePartyBill.jsx:63`, `EditPartyBill.jsx:72,126`). Nới.                      |
| `POST /players`            | `users.create`, `users.view`, `$billForms`, `$partyBillForms` | Thêm nhanh người chơi trong form bill (`PlayerSelector.jsx:213`) và bill tiệc (`PartyQuickAddPlayer.jsx:53`); nút "Thêm" / "Thêm nhanh" màn Người chơi không kiểm quyền (`PlayersManagement.jsx:104,143`). Nới. |
| `GET /players/{player}`    | `users.view`                                                  | Frontend không gọi.                                                                                                                                                                                             |
| `PUT /players/{player}`    | `users.update`                                                | Sửa người chơi (`PlayersManagement.jsx:98`). Nút không kiểm quyền — **không nới**, mục 4.2.                                                                                                                     |
| `DELETE /players/{player}` | `users.delete`                                                | Xóa người chơi (`PlayersManagement.jsx:160`). **Không nới**, mục 4.2.                                                                                                                                           |
| `GET /players/{id}/debts`  | `users.view`                                                  | Frontend không gọi.                                                                                                                                                                                             |
| `POST /players/{id}/roles` | `roles.assign`                                                | Gán vai trò (`PlayersManagement.jsx:177`). Theo yêu cầu PM.                                                                                                                                                     |

### Mức tính, menu nước, loại cầu, tài khoản nhận tiền

| Route                                                                                                       | Quyền (một trong)                               | Màn gọi / lý do                                                                                                                                                                             |
| ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /ratios`                                                                                               | `$masterTabs`, `$billForms`, `$partyBillForms`  | Tab Mức tính (`RatiosManagement.jsx:29`); mức tính mặc định khi thêm nhanh người chơi (`utils/genderRatio.js:22`, dùng ở `PlayerSelector.jsx:45`, `PartyQuickAddPlayer.jsx:17`). Nới (đọc). |
| `GET /ratios/defaults`                                                                                      | như `GET /ratios`                               | Frontend không gọi (`ratiosApi.getDefaults` không ai dùng). Đang bị `ratios/{ratio}` che, xem mục 6.                                                                                        |
| `GET /ratios/{ratio}`                                                                                       | `ratios.view`                                   | Frontend không gọi.                                                                                                                                                                         |
| `POST` / `PUT` / `DELETE /ratios…`                                                                          | `ratios.create` / `.update` / `.delete`         | Tab Mức tính (`RatiosManagement.jsx:53,55,70`). Nút không kiểm quyền — **không nới**, mục 4.2.                                                                                              |
| `GET /menus`                                                                                                | `$masterTabs`, `$billForms`                     | Tab Menu nước (`MenusManagement.jsx:57`); chọn món trong tạo / sửa bill (`CreateBill.jsx:99`, `EditBill.jsx:271`). Nới (đọc).                                                               |
| `POST /menus`                                                                                               | `menus.create`, `$billForms`                    | Tab Menu nước (`MenusManagement.jsx:78`); "Thêm menu" nhanh trong form bill, không kiểm quyền (`QuickAddMenu.jsx:92`). Nới.                                                                 |
| `GET /menus/{menu}`                                                                                         | `menus.view`                                    | Frontend không gọi.                                                                                                                                                                         |
| `PUT` / `DELETE /menus/{menu}`                                                                              | `menus.update` / `menus.delete`                 | Sửa, bật / tắt, xóa món (`MenusManagement.jsx:76,99,112`). **Không nới**, mục 4.2.                                                                                                          |
| `GET /shuttles`                                                                                             | `bills.view`, `$masterTabs`, `$billForms`       | Tồn kho cầu ở Dashboard (`Dashboard.jsx:109`); tab Loại cầu (`ShuttlesManagement.jsx:70`); tạo / sửa bill (`CreateBill.jsx:81`, `EditBill.jsx:206,309`). Nới (đọc).                         |
| `GET /shuttles/{shuttle}`                                                                                   | `shuttles.view`                                 | Frontend không gọi.                                                                                                                                                                         |
| `POST` / `PUT` / `DELETE /shuttles…`                                                                        | `shuttles.create` / `.update` / `.delete`       | Tab Loại cầu, nút đã kiểm đúng các quyền này.                                                                                                                                               |
| `GET /shuttles/{id}/stock-entries`, `GET /shuttles/{id}/prices`                                             | `shuttles.view`, `shuttles.update`              | "Lịch sử", "Lên giá" — chỉ hiện khi có `shuttles.update` (`ShuttlesManagement.jsx:223`).                                                                                                    |
| `POST /shuttles/{id}/stock-entries`, `POST /shuttles/{id}/prices`, `DELETE /shuttles/{id}/prices/{priceId}` | `shuttles.update`                               | Nhập kho, thêm / xóa mốc giá — nút kiểm `shuttles.update`.                                                                                                                                  |
| `GET /court-prices`                                                                                         | `$masterTabs`, `$billForms`                     | Tab Giá sân (`CourtPricesManagement.jsx`); bảng "Tính theo giờ" của bill con lấy giá theo ngày bill (`useCourtPrices.js`). Nới (đọc). Thêm 2026-11-10.                                         |
| `POST /court-prices`, `DELETE /court-prices/{id}`                                                           | `shuttles.update`                               | "Lên giá" / xoá mốc giá sân — dùng chung quyền sửa loại cầu, nút kiểm `shuttles.update`. Không xoá được mốc cuối (422). Thêm 2026-11-10.                                                     |
| `GET /payment-accounts`                                                                                     | `bills.view`, `party_bills.view`, `$masterTabs` | Chi tiết bill (`BillDetail.jsx:348`) và bill tiệc (`PartyBillDetail.jsx:134`) dựng ảnh QR; tab TK nhận tiền (`PaymentAccountsManagement.jsx:31`). Nới (đọc).                                |
| `GET /payment-accounts/{payment_account}`                                                                   | `payment_accounts.view`                         | Frontend không gọi.                                                                                                                                                                         |
| `POST /payment-accounts`                                                                                    | `payment_accounts.create`                       | Tab TK nhận tiền (`:112`). **Không nới**, mục 4.2.                                                                                                                                          |
| `PUT /payment-accounts/{payment_account}`, `POST /payment-accounts/{id}/update`                             | `payment_accounts.update`                       | Tab TK nhận tiền dùng `PUT` (`:108`); route `POST …/update` frontend không gọi. **Không nới**.                                                                                              |
| `DELETE /payment-accounts/{payment_account}`                                                                | `payment_accounts.delete`                       | Tab TK nhận tiền (`:128`). **Không nới**.                                                                                                                                                   |

### Bill cầu, nợ

| Route                                      | Quyền (một trong)             | Màn gọi / lý do                                                                                                                                                                    |
| ------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /bills`                               | `bills.view`                  | Dashboard (`Dashboard.jsx:141,424`).                                                                                                                                               |
| `POST /bills`                              | `bills.create`                | Tạo bill (`CreateBill.jsx:269`).                                                                                                                                                   |
| `GET /bills/{bill}`                        | `bills.view`, `$billForms`    | Chi tiết bill (`BillDetail.jsx:101,193`); sửa bill (`EditBill.jsx:201`, màn chỉ cần `bills.update`); tạo bill con nạp bill cha (`CreateBill.jsx:123`, màn chỉ cần `bills.create`). |
| `PUT /bills/{bill}`                        | `bills.update`                | Sửa bill (`EditBill.jsx:410`).                                                                                                                                                     |
| `DELETE /bills/{bill}`                     | `bills.delete`                | Dashboard / chi tiết, nút kiểm `bills.delete` (`Dashboard.jsx:848`, `BillDetail.jsx:559`).                                                                                         |
| `POST /bills/{id}/players/{player_id}/pay` | `bills.mark_payment`          | Dashboard "Đã trả hết", chi tiết bill — nút kiểm `bills.mark_payment`.                                                                                                             |
| `GET /bills/{id}/sub-bills` / `POST`       | `bills.view` / `bills.create` | Frontend không gọi (bill con tạo qua `POST /bills`).                                                                                                                               |
| `POST /bills/{id}/send-telegram`           | `bills.view`                  | Nút "Gửi Telegram" ở chi tiết bill hiện cho mọi người xem được bill (`BillDetail.jsx:657-664`, gọi `:482`). Nới.                                                                   |
| `GET /debts`, `GET /debts/{debt}`          | `users.view`                  | Frontend không gọi; không có quyền riêng cho nợ, nợ gắn với người chơi.                                                                                                            |
| `POST` / `PUT` / `DELETE /debts…`          | `users.update`                | Như trên.                                                                                                                                                                          |

### Bill tiệc, thuê xe, giá xăng

| Route                                                               | Quyền (một trong)                            | Màn gọi / lý do                                                                                                                                              |
| ------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /party-bills`                                                  | `party_bills.view`, `car_rentals.view`       | Danh sách bill tiệc (`PartyBills.jsx:90`); màn Thuê xe nạp danh sách để "Gắn vào bill tiệc" (`CarRentalCalculator.jsx:283`, mở cho `car_rentals.view`). Nới. |
| `POST /party-bills`                                                 | `party_bills.create`                         | Tạo bill tiệc (`CreatePartyBill.jsx:99`).                                                                                                                    |
| `GET /party-bills/{party_bill}`                                     | `party_bills.view`, `party_bills.update`     | Chi tiết (`PartyBillDetail.jsx:121,222`); sửa (`EditPartyBill.jsx:71`, màn chỉ cần `party_bills.update`).                                                    |
| `PUT /party-bills/{party_bill}`                                     | `party_bills.update`                         | Sửa bill tiệc (`EditPartyBill.jsx:169`).                                                                                                                     |
| `DELETE /party-bills/{party_bill}`                                  | `party_bills.delete`                         | Nút kiểm `party_bills.delete`.                                                                                                                               |
| `POST /party-bills/{id}/participants/{participantId}/pay`           | `party_bills.update`                         | Đánh dấu thanh toán; frontend đã chốt dùng `party_bills.update` (`PartyBills.jsx:223`, `PartyBillDetail.jsx:433`).                                           |
| `POST /party-bills/{id}/send-telegram`                              | `party_bills.view`                           | Nút "Gửi Telegram" hiện cho mọi người xem được bill (`PartyBillDetail.jsx:506-513`). Nới.                                                                    |
| `GET /car-rentals`, `GET /car-rentals/{car_rental}`                 | `car_rentals.view`                           | Tab Lịch sử (`CarRentalHistory.jsx:44`); `GET {id}` frontend không gọi.                                                                                      |
| `POST` / `PUT` / `DELETE /car-rentals…`                             | `car_rentals.create` / `.update` / `.delete` | Nút kiểm đúng các quyền này (`CarRentalCalculator.jsx:508-510`, `CarRentalHistory.jsx:37-38`).                                                               |
| `GET /fuel-prices`                                                  | `car_rentals.view`                           | Màn Thuê xe nạp giá xăng thị trường (`CarRentalCalculator.jsx:260`).                                                                                         |
| `POST /fuel-prices/{fuelKey}/refresh`, `PUT /fuel-prices/{fuelKey}` | `car_rentals.update`                         | Frontend không gọi.                                                                                                                                          |

### Vai trò và quyền

| Route                                       | Quyền (một trong)                      | Màn gọi / lý do                                                                                    |
| ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `GET /roles`                                | `roles.view`, `roles.assign`           | Màn Quyền (`RolesManagement.jsx:32`); hộp gán vai trò màn Người chơi (`PlayersManagement.jsx:66`). |
| `GET /roles/{role}`                         | `roles.view`                           | Frontend không gọi.                                                                                |
| `POST` / `PUT` / `DELETE /roles…`           | `roles.create` / `.update` / `.delete` | Màn Quyền (`RolesManagement.jsx:73,75,91`), nút không kiểm quyền — **không nới**, mục 4.2.         |
| `GET /permissions`, `GET /permissions/{id}` | `roles.view`                           | Màn Quyền (`RolesManagement.jsx:33`).                                                              |

### Xếp bảng (dữ liệu theo từng người tạo danh sách)

| Route                                                                                                           | Quyền (một trong)                                             | Màn gọi / lý do                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /player-lists`                                                                                             | `tournament_brackets.view`                                    | Màn Xếp bảng (`TournamentBrackets.jsx:106`).                                                                                                                                  |
| `POST /player-lists`                                                                                            | `tournament_brackets.view`, `tournament_brackets.create_list` | Màn tự tạo "Danh sách mặc định" khi người dùng chưa có danh sách (`:116`, `:173`) — chạy cho mọi người vào màn; nút "Tạo danh sách" kiểm `create_list` (`:203`, `:410`). Nới. |
| `GET /player-lists/{player_list}`                                                                               | `tournament_brackets.view`                                    | Frontend không gọi.                                                                                                                                                           |
| `PUT /player-lists/{player_list}`                                                                               | `tournament_brackets.create_list`                             | Frontend không gọi.                                                                                                                                                           |
| `DELETE /player-lists/{player_list}`                                                                            | `tournament_brackets.delete`                                  | Frontend không gọi.                                                                                                                                                           |
| `GET /tournament-players`                                                                                       | `tournament_brackets.view`                                    | `:138`.                                                                                                                                                                       |
| `POST /tournament-players`, `POST /tournament-players/import`, `DELETE /tournament-players/{tournament_player}` | `tournament_brackets.view`, `tournament_brackets.create_list` | "Thêm VĐV thủ công" (`:459`, gọi `:229`), "Import Excel/CSV" (`:466`, gọi `:273`), "Xóa" VĐV (`:537`, gọi `:251`) — không kiểm quyền. Nới.                                    |
| `GET` / `PUT /tournament-players/{tournament_player}`                                                           | `view` / `create_list`                                        | Frontend không gọi.                                                                                                                                                           |
| `GET /player-lists/{playerListId}/brackets`                                                                     | `tournament_brackets.view`                                    | `:149`.                                                                                                                                                                       |
| `GET /player-lists/{playerListId}/brackets/{bracketId}`                                                         | `tournament_brackets.view`                                    | Frontend không gọi.                                                                                                                                                           |
| `POST /player-lists/{playerListId}/brackets/organize`                                                           | `tournament_brackets.organize`                                | Nút "Xếp bảng" kiểm `organize` (`:591`, gọi `:300`).                                                                                                                          |
| `DELETE /player-lists/{playerListId}/brackets`                                                                  | `tournament_brackets.delete`                                  | "Xóa tất cả" kiểm `delete` (`:600`, gọi `:316`).                                                                                                                              |
| `DELETE /player-lists/{playerListId}/brackets/{bracketId}`                                                      | `tournament_brackets.delete`                                  | Frontend không gọi.                                                                                                                                                           |

## 4. Cần chủ dự án quyết

### 4.1. Chỗ đã nới quyền để giữ thao tác giao diện đang có

| #   | Route                                                                                                                  | Nới thêm cho                                                                             | Vì                                                                                                      | Rủi ro                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | `POST /players`                                                                                                        | `bills.create`, `bills.update`, `party_bills.create`, `party_bills.update`, `users.view` | Thêm nhanh người chơi trong form bill / bill tiệc; nút Thêm ở màn Người chơi không kiểm quyền           | Tạo được tài khoản mới (mật khẩu "password", không vai trò → sau sửa này không gọi được API nào ngoài `/me`).                        |
| 2   | `POST /menus`                                                                                                          | `bills.create`, `bills.update`                                                           | "Thêm menu" nhanh trong form bill                                                                       | Thêm được món mới (không sửa / xóa được).                                                                                            |
| 3   | `POST /bills/{id}/send-telegram`, `POST /party-bills/{id}/send-telegram`                                               | quyền xem bill tương ứng                                                                 | Nút "Gửi Telegram" không kiểm quyền                                                                     | Người chỉ xem gửi được ảnh bill vào nhóm Telegram.                                                                                   |
| 4   | `GET /party-bills`                                                                                                     | `car_rentals.view`                                                                       | Ô "Gắn vào bill tiệc" ở màn Thuê xe                                                                     | Người chỉ có quyền thuê xe đọc được danh sách bill tiệc. Hiện chỉ admin có `car_rentals.*`.                                          |
| 5   | `POST /player-lists`, `POST /tournament-players`, `POST /tournament-players/import`, `DELETE /tournament-players/{id}` | `tournament_brackets.view`                                                               | Màn tự tạo danh sách mặc định; Thêm VĐV / Import / Xóa VĐV không kiểm quyền                             | Chỉ đụng danh sách của chính người gọi (controller lọc `user_id`). `tournament_viewer` thêm / xóa được VĐV trong danh sách của mình. |
| 6   | `GET /players`, `/ratios`, `/menus`, `/shuttles`, `/payment-accounts`, `/roles`                                        | các quyền ở mục 3                                                                        | Danh sách đọc dùng chung nhiều màn (form bill, Dashboard, chi tiết bill, 4 tab Master, hộp gán vai trò) | Chỉ đọc. `GET /players` trả cả email người chơi (mục 6).                                                                             |

Đề xuất nếu muốn siết lại 3 và 5: frontend ẩn nút theo `bills.update` / `party_bills.update`
(Gửi Telegram) và `tournament_brackets.create_list` (Thêm / Import / Xóa VĐV), rồi bỏ quyền
nới ở backend.

### 4.2. Chỗ KHÔNG nới — giao diện vẫn hiện nút nhưng backend trả 403

Những nút này nằm trên màn không kiểm quyền từng nút; nới theo quyền vào màn thì vai trò
chỉ có quyền xem sẽ làm được việc nguy hiểm, nên giữ đúng quyền cùng tên:

| Màn (quyền vào màn)                                                                                                                                                  | Nút trả 403 khi thiếu quyền                                                                                                               | Nếu nới thì                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Người chơi (`users.view`) — `PlayersManagement.jsx` không có `hasPermission` nào                                                                                     | Sửa (`users.update`), Xóa (`users.delete`), Gán vai trò (`roles.assign`); hộp gán vai trò không tải được danh sách vai trò (`GET /roles`) | `PUT /players/{id}` đổi được email + mật khẩu của bất kỳ ai, kể cả admin (`UpdateUserRequest.php:24-31`) → chiếm tài khoản; tự gán vai trò admin. |
| Master → Mức tính, Menu nước, TK nhận tiền (một trong 4 quyền xem) — `RatiosManagement.jsx`, `MenusManagement.jsx`, `PaymentAccountsManagement.jsx` không kiểm quyền | Thêm / Sửa / Xóa mức tính; Sửa / bật-tắt / Xóa menu (Thêm menu vẫn được nếu có `bills.create`); Thêm / Sửa / Xóa tài khoản nhận tiền      | Đổi được số tài khoản / mã QR nhận tiền in trên bill; đổi mức tính làm sai tiền mọi bill sau.                                                     |
| Quyền (`roles.view`) — `RolesManagement.jsx` không kiểm quyền                                                                                                        | Thêm / Sửa / Xóa vai trò                                                                                                                  | Tự thêm quyền vào vai trò của mình.                                                                                                               |

Ảnh hưởng trên production hiện tại: **không ai** — chỉ vai trò `scheduler` (0 người) chạm
dòng 1–2; `roles.view` chỉ admin có. Việc nên làm tiếp (ngoài phạm vi task này): frontend
ẩn các nút trên theo `users.update/delete`, `roles.assign`, `ratios.*`, `menus.*`,
`payment_accounts.*`, `roles.*`, và Master chỉ hiện tab có quyền xem.

### 4.3. Route frontend không gọi — quyền chọn theo tên, cần xác nhận

`GET /players/{id}`, `GET /players/{id}/debts`, `/debts/*` (không có quyền riêng → `users.view`
đọc, `users.update` ghi), `GET /ratios/{id}`, `GET /ratios/defaults`, `GET /menus/{id}`,
`GET /shuttles/{id}`, `GET /payment-accounts/{id}`, `POST /payment-accounts/{id}/update`,
`/bills/{id}/sub-bills`, `GET /car-rentals/{id}`, `POST /fuel-prices/{key}/refresh` và
`PUT /fuel-prices/{key}` (`car_rentals.update`), `GET /roles/{id}`, `GET /permissions/{id}`,
`GET` / `PUT` / `DELETE /player-lists/{id}` (xóa danh sách → `tournament_brackets.delete`),
`GET` / `PUT /tournament-players/{id}`, `GET` / `DELETE …/brackets/{bracketId}`.

## 5. Kiểm chứng

- `php artisan test` (SQLite `:memory:`): trước sửa **132 passed / 0 failed**; sau sửa
  **229 passed / 0 failed** (thêm 97 test trong `tests/Feature/ApiPermissionTest.php`).
  Commit test đầu (`8bef349`) chạy riêng: 132 passed.
- `ApiPermissionTest`:
  - đặc tả: mọi route `api/*` trừ `login` / `logout` / `me` / `images` có `auth` và đúng một
    middleware `permission:` khớp bảng mục 3; mọi quyền dùng có trong `RolePermissionSeeder`;
  - ma trận cho **từng** route (86 bộ dữ liệu): khách → 401; đăng nhập không vai trò → 403 +
    đúng JSON; có mọi quyền khác trừ quyền của route → 403; có từng quyền của route → không
    401 / 403;
  - admin (đủ quyền seeder) gọi được mọi route;
  - 3 vai trò production (bộ quyền bản dump 15/10/2026): mọi API màn của vai trò gọi không bị
    403, các thao tác không có quyền bị 403;
  - luồng thật: `scheduler` thêm nhanh người chơi → tạo bill → đánh dấu thanh toán → tạo bill
    tiệc → đánh dấu thanh toán bill tiệc; `tournament_scheduler` tạo danh sách → thêm 4 VĐV →
    import CSV → xóa VĐV → xếp bảng → xem bảng → xóa tất cả bảng.
- `php artisan route:list --path=api -v`: 90 route, 88 có `auth`, 86 có `permission:`; hai
  route có `auth` mà không có quyền là `POST logout`, `GET me`.
- `php artisan route:cache` chạy được (production dùng, `deploy.sh:110`,
  `docker/entrypoint.sh:19`), đã `route:clear` lại.
- `vendor/bin/pint --test` các file PHP đã sửa: PASS.
- Frontend không sửa (mục 7) nên không chạy `npm test` / `eslint`.

## 6. Lỗi / rủi ro ngoài phạm vi (không sửa)

- `BACKEND/routes/api.php:56` — `GET ratios/defaults` khai báo sau `apiResource('ratios')`
  (`:50`) nên khi không cache route, request tới đó rơi vào `ratios/{ratio}` (đã kiểm bằng
  `Route::getRoutes()->match`). Có từ trước (`main`: dòng 35–36); frontend không gọi.
- `BACKEND/app/Http/Controllers/Api/PlayerListController.php:21` (và `PlayerController`,
  `BracketController`) — dữ liệu xếp bảng lọc theo người tạo, nên `tournament_viewer` chỉ thấy
  danh sách của chính mình, không xem được bảng người khác xếp.
- Mật khẩu mặc định `password` khi tạo người chơi: `FRONTEND/src/components/bill/PlayerSelector.jsx:211`,
  `components/party/PartyQuickAddPlayer.jsx:51`, `screens/players/PlayersManagement.jsx:103,141`;
  `GET /players` trả email mọi người (`UserController.php:17-69`). Sau sửa này các tài khoản đó
  không có vai trò nên vô hại, nhưng nếu ai đó gán vai trò cho tài khoản người chơi thì ai biết
  email đều đăng nhập được.
- `POST /login` không giới hạn số lần thử (`routes/api.php:23`).
- `BACKEND/app/Http/Requests/StoreRoleRequest.php:14` còn ghi "TODO: Add permission check" —
  việc kiểm quyền nay ở middleware route, TODO đã cũ.
- Thiếu ẩn nút theo quyền ở frontend: xem mục 4.2 và 4.1 (#3, #5).

## 7. Frontend gặp 403

`FRONTEND/src/services/api.js` không có interceptor; `AuthContext.jsx` chỉ gọi `/me` lúc mở
app (route `/me` không gắn quyền nên không bao giờ 403) và không đăng xuất khi API trả lỗi.
Gặp 403 mỗi màn rơi vào nhánh `catch` sẵn có (thông báo lỗi chung, hoặc hiện
`error.response.data.message`) — không đăng xuất, không gọi lại vô hạn. Không cần sửa.

## 8. Khôi phục

Không có migration hay thay đổi dữ liệu, nên khôi phục chỉ là code:

```bash
git revert <hash của commit "fix(api): kiểm quyền từng route API…">   # 0d3d1a2 trên nhánh
# deploy lại như thường lệ (deploy.sh), rồi reload php8.4-fpm vì OPcache không tự nạp code mới
```

Commit `test(api): …` (`8bef349`) để lại cũng được: test cũ chạy bằng người dùng admin, vẫn
xanh khi bỏ kiểm quyền (đã chạy: 132 passed). Commit tài liệu không ảnh hưởng chạy.
Nếu merge bằng merge commit thì revert merge commit đó (`git revert -m 1 <merge>`).

## 9. Rủi ro khi deploy

| Vai trò (số người trên production)              | Sau deploy                                                                                                                                                                                                                |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `admin` (1)                                     | Đủ 42 quyền → mọi API như cũ (test `admin gọi được mọi API`).                                                                                                                                                             |
| `tournament_scheduler` (1)                      | Làm đủ luồng xếp bảng (test luồng thật). Gọi API ngoài xếp bảng (bill, người chơi…) → 403; giao diện vốn đã chặn các màn đó.                                                                                              |
| `scheduler` (0)                                 | Tạo / sửa bill, thêm nhanh người chơi + menu, đánh dấu thanh toán, bill tiệc, xếp bảng: được. **403** ở: Sửa / Xóa / Gán vai trò màn Người chơi; Thêm / Sửa / Xóa ở tab Mức tính, TK nhận tiền; Sửa / Xóa menu (mục 4.2). |
| `tournament_viewer` (0)                         | Xem + thao tác danh sách VĐV của chính mình được (mục 4.1 #5); Xếp bảng / Xóa bảng: nút đã tắt, backend 403.                                                                                                              |
| Tài khoản không vai trò (người chơi tạo nhanh…) | Trước gọi được mọi API, giờ chỉ `/me`, `/logout`; giao diện vốn hiện "Bạn chưa được cấp quyền truy cập…".                                                                                                                 |

Khác: quyền đọc từ DB mỗi request (thêm 1 truy vấn `EXISTS`), đổi vai trò có hiệu lực ngay,
phiên đăng nhập hiện có không bị đăng xuất. Production chạy `route:cache` — sau deploy phải
chạy lại (deploy.sh đã có) và reload `php8.4-fpm`.
