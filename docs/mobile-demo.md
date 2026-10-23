# Demo giao diện mobile gọn hơn

Branch: `feat/compact-mobile-ui`.

## Chạy thử

```powershell
cd FRONTEND
npm ci
npm run demo
```

Mở http://localhost:3001. Để thử bằng điện thoại cùng Wi-Fi, mở địa chỉ
`Network` được Vite in ra, cổng `3001` (máy tính cần cho phép kết nối cổng này).

Demo tự đăng nhập bằng tài khoản mẫu. API chạy trong bộ nhớ của tiến trình Vite,
không kết nối backend thật, kể cả khi máy có cấu hình `VITE_API_URL`.
Dữ liệu có bill chính/con, đã thanh toán/một phần/chưa thanh toán, quá hạn và
nhiều trang. Ngày mẫu được tính theo ngày chạy demo.

Có thể thử danh sách bill cầu, bill tiệc, bộ lọc, thống kê, xem chi tiết,
hộp xác nhận xóa. Xóa và đánh dấu thanh toán bill cầu chỉ thay đổi dữ liệu mẫu;
khởi động lại demo để phục hồi. Tạo/sửa bill, gửi Telegram và các thao tác ghi
khác không được hỗ trợ trong demo.

`npm run dev`, build và deploy vẫn dùng cấu hình ứng dụng thông thường.
Demo dùng riêng `vite.demo.config.js` và `demo/api.mjs`, không được nhập vào
bundle sản xuất.

## Thay đổi giao diện

- Mobile: header 48 px, thanh điều hướng 56 px, giảm khoảng cách và tiêu đề.
- Trạng thái luôn hiển thị; ngày, số bill/trang và tìm tên tiệc nằm trong bộ lọc mở rộng.
- Bill cầu dạng hàng gọn, bấm vào hàng để mở chi tiết; nút xóa tách riêng.
- Bill con nằm ngay dưới bill chính, có thụt lề và màu nền riêng.
- Bill tiệc dùng bộ lọc và bố cục gọn tương tự.
- Vùng bấm trên mobile tối thiểu 44 px; ô nhập giữ chữ 16 px.
- Desktop tiếp tục dùng bảng và bộ lọc đầy đủ.

## Kiểm tra

Trên viewport 390 × 844, cùng dữ liệu mẫu, bill cầu thông thường giảm từ
213 px xuống khoảng 92 px; danh sách bắt đầu tại y=194 thay vì y=510.
Hiển thị trọn 5 nhóm bill (6 hàng gồm bill con) trước thanh điều hướng.

Đã kiểm tra dashboard ở chiều rộng 320, 375, 390, 430, 640, 768 và 1440 px:
không tràn ngang; bộ lọc mở/đóng, ngày, trạng thái, xóa lọc, số bill/trang,
thống kê, mở/hủy xác nhận xóa và liên kết chi tiết hoạt động.

Bill tiệc được kiểm tra ở 320, 390, 640, 768 và 1440 px, gồm tìm tên và
mở/đóng bộ lọc. Phân trang bill cầu đã thử chuyển trang đi/về.
Build sản xuất và 46 unit tests đạt. Lint các file thay đổi không có lỗi;
lint toàn dự án còn 3 lỗi có sẵn trong CurrencyInput, SelectPaymentAccountDialog
và AuthContext.

Kiểm tra trình duyệt dùng Chromium mô phỏng viewport, chưa thay thế kiểm tra
trên thiết bị iOS/Android thật.
