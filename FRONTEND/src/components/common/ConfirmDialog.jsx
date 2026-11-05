import Modal from "../ui/Modal";
import { Loader } from "../ui/icons";

/**
 * Hộp xác nhận. Mặc định là xác nhận xóa (nút "Xóa" màu rose); việc khác thì truyền
 * confirmLabel và confirmVariant="primary".
 * busy: đang gọi API — nút xác nhận quay (giữ nhãn), cả hai nút và nút đóng tắt, bấm nền /
 * Esc không đóng → không gửi 2 lệnh khi bấm đúp. Màn tự đóng hộp khi API xong.
 * message: chữ hoặc node.
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Xóa",
  confirmVariant = "danger",
  busy = false,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <div className="flex gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="btn btn-secondary flex-1 sm:flex-none"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            aria-busy={busy || undefined}
            className={`btn ${confirmVariant === "primary" ? "btn-primary" : "btn-danger"} flex-1 sm:flex-none`}
          >
            {busy && <Loader className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      }
    >
      <div className="text-sm text-slate-600">{message}</div>
    </Modal>
  );
}
