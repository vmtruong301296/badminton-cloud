import CurrencyInput from "../common/CurrencyInput";
import NumberInput from "../common/NumberInput";
import Modal from "../ui/Modal";
import { Trash2 } from "../ui/icons";
import { focusNextOnEnter } from "../bill/billFormFocus";
import { formatCurrencyRounded } from "../../utils/formatters";

export function GenderTag({ gender }) {
  if (gender === "female")
    return (
      <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
        Nữ
      </span>
    );
  if (gender === "male")
    return (
      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
        Nam
      </span>
    );
  return null;
}

export function PaidTag() {
  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
      Đã TT
    </span>
  );
}

/**
 * Sheet sửa một người trong form bill tiệc (điện thoại): 4 ô cũ của thẻ người (Mức tính, Đã chi,
 * Tiền thêm, Ghi chú), xem trước Chia bill / Thành tiền; "Xóa khỏi bill" ở chân (không có với
 * người đã TT). Không tự bật bàn phím khi mở; Enter nhảy ô kế.
 *
 * participant: người đang sửa, đã kèm share / totalAmount của xem trước (null = đóng).
 */
export default function PartyParticipantSheet({
  participant,
  onClose,
  onChange,
  onRemove,
}) {
  const isOpen = Boolean(participant);
  const p = participant || {};

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={p.name}
      initialFocus="panel"
      footer={
        <div className="flex gap-2">
          {!p.is_paid && (
            <button
              type="button"
              onClick={onRemove}
              className="btn btn-danger-soft flex-1"
            >
              <Trash2 className="h-4 w-4" />
              Xóa khỏi bill
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary flex-1"
          >
            Xong
          </button>
        </div>
      }
    >
      {isOpen && (
        <div
          onKeyDown={(e) => {
            focusNextOnEnter(e);
            // Sheet nằm trong cây React của <form>: không để Enter đi tiếp lên form.
            if (e.key === "Enter") e.stopPropagation();
          }}
        >
          {(p.gender || p.is_paid) && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              <GenderTag gender={p.gender} />
              {p.is_paid && <PaidTag />}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="min-w-0">
              <label htmlFor="pbs-ratio" className="field-label">
                Mức tính
              </label>
              <NumberInput
                id="pbs-ratio"
                // API trả mức tính dạng chuỗi "1.000": hiện thành số (1) cho khỏi đọc nhầm nghìn
                value={Number(p.ratio_value)}
                onChange={(value) => onChange("ratio_value", value)}
                min={0}
                step={0.1}
                baseClassName="field-input"
                selectOnFocus
                enterKeyHint="next"
                data-next="person"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="pbs-paid" className="field-label">
                Đã chi
              </label>
              <CurrencyInput
                id="pbs-paid"
                value={p.paid_amount || 0}
                onChange={(value) => onChange("paid_amount", value)}
                baseClassName="field-input"
                placeholder="0"
                selectOnFocus
                enterKeyHint="next"
                data-next="person"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="pbs-food" className="field-label">
                Tiền thêm
              </label>
              <CurrencyInput
                id="pbs-food"
                value={p.food_amount || 0}
                onChange={(value) => onChange("food_amount", value)}
                baseClassName="field-input"
                placeholder="0"
                selectOnFocus
                enterKeyHint="next"
                data-next="person"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="pbs-note" className="field-label">
                Ghi chú
              </label>
              <input
                id="pbs-note"
                type="text"
                value={p.note || ""}
                onChange={(e) => onChange("note", e.target.value)}
                className="field-input"
                placeholder="—"
                enterKeyHint="done"
                data-next="person"
              />
            </div>
          </div>
          <dl className="mt-4 divide-y divide-slate-100 text-sm">
            <div className="flex items-baseline justify-between gap-3 pb-2.5">
              <dt className="text-slate-600">Chia bill</dt>
              <dd className="font-tabular font-semibold text-slate-900">
                {formatCurrencyRounded(p.share || 0)}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3 pt-2.5">
              <dt className="text-slate-600">Thành tiền</dt>
              <dd className="amount-lg text-emerald-700">
                {formatCurrencyRounded(p.totalAmount || 0)}
              </dd>
            </div>
          </dl>
        </div>
      )}
    </Modal>
  );
}
