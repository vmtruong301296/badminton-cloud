import Modal from "../ui/Modal";
import EmptyState from "../ui/EmptyState";
import { Check, Inbox, Loader } from "../ui/icons";
import { formatCurrencyRounded, formatDateShort } from "../../utils/formatters";
import { isUnpaidParticipantOverdue } from "../../utils/partyBillList";

/**
 * Sheet "Chưa thanh toán" (dưới lg; từ lg là khối ở cột phải): mỗi người tên, tổng còn nợ, các
 * ngày thiếu (M6) và nút "Đã trả hết" (M3b) — màn cha hỏi lại bằng ConfirmDialog qua onPayAll.
 * Người có khoản quá 7 ngày có nền rose.
 *
 * people: kết quả collectPartyUnpaid; canMark: party_bills.update; markingIds: Set user_id đang lưu.
 */
export default function PartyUnpaidSheet({
  isOpen,
  onClose,
  people,
  total,
  canMark,
  markingIds,
  onPayAll,
}) {
  const today = new Date();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chưa thanh toán"
      initialFocus="panel"
    >
      <p className="text-sm text-slate-600">
        <span className="font-tabular font-semibold text-slate-700">
          {people.length}
        </span>{" "}
        người · Tổng:{" "}
        <span className="amount-lg ml-0.5 text-rose-700">
          {formatCurrencyRounded(total)}
        </span>
      </p>

      {people.length === 0 ? (
        <div className="mt-3">
          <EmptyState compact icon={Inbox} title="Tất cả đã thanh toán" />
        </div>
      ) : (
        <ul className="-mx-5 mt-3 border-t border-slate-100">
          {people.map((person) => {
            const marking = markingIds.has(person.userId);
            const overdue = isUnpaidParticipantOverdue(person, today);
            return (
              <li
                key={person.userId}
                className={`flex items-center gap-3 border-b border-slate-100 py-3 pl-5 pr-4 last:border-b-0 ${overdue ? "bg-rose-50/70" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="break-words text-[15px] font-semibold leading-5 text-slate-900 [overflow-wrap:anywhere]">
                    {person.name}
                  </div>
                  <div className="amount mt-0.5 text-rose-700">
                    {formatCurrencyRounded(person.totalAmount)}
                  </div>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {person.unpaidDates.map((item) => (
                      <li
                        key={item.date}
                        className="whitespace-nowrap rounded-md bg-white/80 px-2 py-0.5 text-[13px] tabular-nums text-slate-700 ring-1 ring-inset ring-slate-200"
                      >
                        {formatDateShort(item.date, today)}:{" "}
                        {formatCurrencyRounded(item.amount)}
                      </li>
                    ))}
                  </ul>
                </div>
                {canMark && (
                  <button
                    type="button"
                    onClick={() => onPayAll(person)}
                    disabled={marking}
                    aria-label={`Đã trả hết: ${person.name}`}
                    className="btn btn-secondary list-row-action gap-1.5 rounded-full border-emerald-300 px-3 text-emerald-800 hover:bg-emerald-50"
                  >
                    {marking ? (
                      <Loader className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    Đã trả hết
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
