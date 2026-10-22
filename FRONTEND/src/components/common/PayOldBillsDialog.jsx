import { formatCurrencyRounded } from '../../utils/formatters';
import Modal from '../ui/Modal';

export default function PayOldBillsDialog({ isOpen, onClose, onPayCurrentOnly, onPayAll, playerName, debtAmount }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận thanh toán"
      size="md"
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onPayCurrentOnly} className="btn btn-secondary">
            Chỉ bill hiện tại
          </button>
          <button type="button" onClick={onPayAll} className="btn btn-primary">
            Cả bill cũ
          </button>
          <button type="button" onClick={onClose} className="btn btn-ghost">
            Hủy
          </button>
        </div>
      }
    >
      <p className="mb-3 break-words text-sm text-slate-600">
        {playerName} có tiền nợ: <span className="font-semibold text-rose-600">{formatCurrencyRounded(debtAmount || 0)}</span>
      </p>
      <p className="text-sm text-slate-700">
        Bạn có muốn thanh toán cho các bill đã nợ trước đó không?
      </p>
    </Modal>
  );
}
