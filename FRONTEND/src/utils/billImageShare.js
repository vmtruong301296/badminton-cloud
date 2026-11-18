/**
 * Gửi / lưu ảnh bill (hộp "Gửi ảnh bill", dùng chung bill cầu và bill tiệc):
 * chọn tài khoản nhận tiền in lên ảnh, cách lưu file, câu lỗi từ API.
 */

/** Tài khoản nhận tiền đang bật. */
export const activePaymentAccounts = (accounts = []) =>
  (accounts || []).filter((account) => account.is_active);

/**
 * Tài khoản chọn sẵn khi mở hộp: tài khoản mặc định của người đăng nhập
 * (users.default_payment_account_id) nếu còn bật, không thì VPBank, không thì
 * tài khoản đang bật đầu tiên.
 */
export const defaultPaymentAccountId = (accounts = [], preferredId = null) => {
  const active = activePaymentAccounts(accounts);
  const preferred =
    preferredId == null
      ? undefined
      : active.find((account) => account.id === Number(preferredId));
  const vpbank = active.find((account) => account.bank_name === "VPBank");
  return (preferred || vpbank || active[0])?.id ?? null;
};

/**
 * Đúng một tài khoản đang bật thì không cần hỏi (quyết định 12): trả id tài
 * khoản đó; 0 hoặc nhiều tài khoản thì null.
 */
export const onlyActivePaymentAccountId = (accounts = []) => {
  const active = activePaymentAccounts(accounts);
  return active.length === 1 ? active[0].id : null;
};

/**
 * "Xuất Bill" trên điện thoại mở bảng chia sẻ của máy (quyết định 11) khi trình
 * duyệt chia sẻ được file; máy tính dùng chuột hoặc máy không hỗ trợ thì tải file
 * như cũ. coarsePointer: matchMedia("(pointer: coarse)").
 */
export const pickImageSaveMethod = ({ coarsePointer, canShareFiles }) =>
  coarsePointer && canShareFiles ? "share" : "download";

/** Chi tiết lỗi gọi API để ghép sau "Gửi Telegram thất bại: " (như câu alert cũ). */
export const apiErrorDetail = (error) =>
  error?.response?.data?.error ||
  error?.response?.data?.message ||
  error?.message ||
  "Lỗi không xác định";
