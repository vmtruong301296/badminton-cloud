import { useContext } from "react";
import ToastContext from "./toastContext";

/**
 * Thông báo ngắn (M8) thay alert() cho kết quả thao tác.
 *
 *   const toast = useToast();
 *   toast.success("Đã gửi bill qua Telegram thành công!");          // tự tắt sau 4 s
 *   toast.error("Có lỗi xảy ra khi xóa bill", { onRetry: handleDelete }); // 7 s, có "Thử lại" + nút đóng
 *   toast.info("…");                                                 // 5 s, không biểu tượng
 *   toast.dismiss();
 *
 * Mỗi lúc một thông báo: cái mới thay cái cũ. Không dùng cho kiểm form (M14),
 * lỗi tải trang (M13) hay lỗi xảy ra khi đang mở sheet (hiện trong sheet).
 */
export default function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) {
    throw new Error("useToast() phải nằm trong <ToastProvider> (App.jsx).");
  }
  return toast;
}
