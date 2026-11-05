# Giới hạn đăng nhập sai (05/11/2026)

Trước đây `POST /api/login` không giới hạn số lần thử. Ai cũng có thể dò mật khẩu không giới hạn,
trong khi người chơi tạo nhanh dùng mật khẩu mặc định và `GET /players` trả email của mọi người.

## Cách làm

- `BACKEND/app/Http/Requests/LoginRequest.php`: kiểm dữ liệu, đếm lần sai, khóa tạm.
  `AuthController::login` gọi `$request->authenticate()`.
- Chỉ lần **sai email / mật khẩu** mới bị đếm. Thiếu email hoặc email sai định dạng thì vẫn trả 422 như cũ và không bị đếm.
- Hai ngưỡng, đếm trong `DECAY_SECONDS` = 15 phút tính từ lần sai đầu tiên:

| Ngưỡng                         | Khóa gì                                              | Mở khóa                                                          |
| ------------------------------ | ---------------------------------------------------- | ---------------------------------------------------------------- |
| 5 lần sai, cùng email + IP     | email đó từ IP đó (email khác, IP khác vẫn vào được) | hết 15 phút, hoặc đăng nhập đúng trước khi chạm ngưỡng (xóa đếm) |
| 30 lần sai, một IP (mọi email) | cả IP (chặn dò nhiều tài khoản)                      | hết 15 phút; đăng nhập đúng **không** xóa đếm theo IP            |

- Email so không phân biệt chữ hoa / thường (MySQL cũng so như vậy).
- Bị khóa thì trả **429**, header `Retry-After: <giây>`, kèm
  `{"message": "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút."}` (dưới 1 phút thì ghi
  "… sau N giây."). Lần đó bị chặn kể cả khi nhập đúng mật khẩu.
- Frontend không sửa: `AuthContext.login` đã hiện `error.response.data.message`.
- Lúc bắt đầu khóa, log ghi **một** dòng `warning` "Khóa đăng nhập tạm thời vì sai nhiều lần", kèm email, IP và
  `scope` (`account` / `ip`).
- Bộ đếm nằm trong cache mặc định của Laravel (`CACHE_STORE`; `.env.example` là `database`, bảng
  `cache` đã có trên production theo dump 15/10). Không có migration.

## Chữ mới (chờ chủ dự án gật)

- "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau {N} phút." / "… sau {N} giây."

## Kiểm chứng

- `tests/Feature/LoginThrottleTest.php` (13 test) kiểm các trường hợp:
  - chạm ngưỡng 5 thì lần sau bị khóa dù đúng mật khẩu;
  - dưới ngưỡng vẫn báo sai như cũ;
  - thời gian chờ đếm ngược;
  - hết 15 phút thì vào lại được;
  - đăng nhập đúng xóa đếm của email;
  - không phân biệt chữ hoa / thường;
  - email khác / IP khác không bị chặn;
  - ngưỡng 30 theo IP;
  - đăng nhập đúng không xóa đếm theo IP;
  - log đúng một lần;
  - lỗi nhập liệu không bị đếm.
- Chạy thật bằng `php artisan serve` với SQLite tạm, `CACHE_STORE=database`, giống production:
  5 lần sai đều trả 422, lần 6 nhập đúng trả `429`, `Retry-After: 899`, đúng câu thông báo. Bảng `cache` có
  khóa `login:account:…` và `login:ip:…`, log có một dòng warning.
- Ảnh màn đăng nhập khi API trả 429 (360 / 1280): câu thông báo nằm trong hộp lỗi sẵn có, xuống dòng gọn.

## Rủi ro khi deploy

- **IP phải là IP thật của người dùng.** Production đi thẳng nginx → php-fpm (`REMOTE_ADDR`), app không
  tin proxy nào, nên người dùng không giả được IP bằng header `X-Forwarded-For`. Nếu sau này đặt
  Cloudflare hay proxy trước server, phải cấu hình trusted proxies. Nếu không, mọi người dùng chung IP của proxy
  và ngưỡng 30 / IP sẽ khóa cả nhóm.
- Worker Cloudflare cũ (`*.workers.dev`), nếu còn ai dùng và nó chuyển tiếp `/api`, thì mọi người qua
  worker chung một IP. Chủ dự án đã thôi dùng worker.
- Nhiều người chung wifi sân, hoặc chung IP nhà mạng di động: chỉ bị khóa cả IP khi **cộng lại** sai 30 lần trong 15 phút.
- Người bị khóa nhầm phải chờ tối đa 15 phút. Gỡ ngay: trên server chạy `php artisan cache:clear`
  (xóa toàn bộ cache của app; ngoài bộ đếm này, app chỉ cache id giá xăng và tự nạp lại; phiên đăng nhập lưu theo `SESSION_DRIVER` (mặc định `database`), không nằm trong cache nên không ai bị đăng xuất).
- Sau deploy nhớ reload `php8.4-fpm` (OPcache).

## Khôi phục

`git revert` commit `fix(auth)`, deploy lại, reload `php8.4-fpm`. Không có dữ liệu hay migration phải gỡ.
