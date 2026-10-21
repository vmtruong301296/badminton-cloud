import Modal from "../ui/Modal";

/**
 * Hộp xác nhận. Mặc định là xác nhận xóa (nút "Xóa" màu rose); việc khác thì truyền
 * confirmLabel và confirmVariant="primary".
 */
export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Xóa",
  confirmVariant = "danger",
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2 sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-secondary flex-1 sm:flex-none"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`btn ${confirmVariant === "primary" ? "btn-primary" : "btn-danger"} flex-1 sm:flex-none`}
          >
            {confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}
