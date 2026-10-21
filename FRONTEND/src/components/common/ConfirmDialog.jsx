import Modal from "../ui/Modal";

export default function ConfirmDialog({ isOpen, onClose, onConfirm, title, message }) {
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
            className="btn btn-danger flex-1 sm:flex-none"
          >
            Xóa
          </button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}
