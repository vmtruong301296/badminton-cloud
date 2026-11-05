import { formatCurrencyRounded, formatDateShort } from '../../utils/formatters';
import Modal from '../ui/Modal';
import { Loader } from '../ui/icons';

/**
 * Hộp "Xác nhận thanh toán" khi người chơi còn nợ bill cũ — bill cầu và bill tiệc dùng chung.
 *
 * Props cũ: isOpen, onClose, onPayCurrentOnly, onPayAll, playerName, debtAmount.
 * Props tùy chọn (không truyền thì hộp hiện như cũ):
 * - debtDetails: debt_details của API ([{ date, parent_amount, sub_bills: [{ note, amount }] }])
 *   → liệt kê từng bill cũ dưới dòng tiền nợ.
 * - currentAmount, allAmount: số thu của "Chỉ bill hiện tại" / "Cả bill cũ", in ngay trên nút.
 * - busy: "current" | "all" → nút đó có vòng quay; true → chỉ khóa. Đang busy thì hai nút khóa,
 *   hộp không đóng.
 * Không có nút "Hủy": đóng bằng ✕, chạm nền hoặc Esc (gọi onClose).
 */
export default function PayOldBillsDialog({
  isOpen,
  onClose,
  onPayCurrentOnly,
  onPayAll,
  playerName,
  debtAmount,
  debtDetails,
  currentAmount,
  allAmount,
  busy = false,
}) {
  const details = debtDetails || [];
  const hasAmounts = currentAmount !== undefined && allAmount !== undefined;

  const renderChoice = (choice, label, amount, onClick, variant) => (
    <button
      type="button"
      onClick={onClick}
      disabled={Boolean(busy)}
      className={`btn ${variant} ${hasAmounts ? 'justify-between sm:justify-center' : ''}`}
    >
      <span className="inline-flex items-center gap-2">
        {busy === choice && <Loader className="h-4 w-4 animate-spin" />}
        {label}
      </span>
      {hasAmounts && <span className="font-tabular">{formatCurrencyRounded(amount)}</span>}
    </button>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Xác nhận thanh toán"
      size="md"
      dismissible={!busy}
      footer={
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          {renderChoice('current', 'Chỉ bill hiện tại', currentAmount, onPayCurrentOnly, 'btn-secondary')}
          {renderChoice('all', 'Cả bill cũ', allAmount, onPayAll, 'btn-primary')}
        </div>
      }
    >
      <p className="mb-3 break-words text-sm text-slate-600">
        {playerName} có tiền nợ: <span className="font-semibold text-rose-600">{formatCurrencyRounded(debtAmount || 0)}</span>
      </p>
      {details.length > 0 && (
        <div className="mb-3 space-y-1 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5 text-sm text-slate-700">
          {details.map((debt, idx) => (
            <div key={idx} className="space-y-1">
              <div className="flex justify-between gap-3">
                <span>{formatDateShort(debt.date)}</span>
                {debt.parent_amount !== null && debt.parent_amount !== undefined && (
                  <span className="font-tabular">{formatCurrencyRounded(debt.parent_amount)}</span>
                )}
              </div>
              {(debt.sub_bills || []).map((subBill, subIdx) => (
                <div key={subIdx} className="flex justify-between gap-3 pl-3">
                  <span className="min-w-0 break-words">{subBill.note || 'Bill con'}</span>
                  <span className="font-tabular flex-shrink-0">{formatCurrencyRounded(subBill.amount)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      <p className="text-sm text-slate-700">
        Bạn có muốn thanh toán cho các bill đã nợ trước đó không?
      </p>
    </Modal>
  );
}
