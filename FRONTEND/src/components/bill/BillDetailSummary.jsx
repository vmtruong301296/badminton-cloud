import { useState } from "react";
import { Link } from "react-router-dom";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
} from "../ui/icons";
import { formatCurrencyRounded, formatDateShort } from "../../utils/formatters";
import { billPerPersonAmount } from "../../utils/billTotals";
import { isMatchSplit } from "../../utils/matchBill";

const STATUS = {
  paid: {
    label: "Đã thanh toán",
    badge: "badge-emerald",
    dot: "bg-emerald-500",
  },
  partial: {
    label: "Thanh toán 1 phần",
    badge: "badge-amber",
    dot: "bg-amber-500",
  },
  unpaid: {
    label: "Chưa thanh toán",
    badge: "badge-slate",
    dot: "bg-slate-400",
  },
};

const statusOf = ({ total, paid }) =>
  total > 0 && paid === total ? "paid" : paid > 0 ? "partial" : "unpaid";

/** Badge trạng thái thu tiền của bill (cùng chữ với đầu màn desktop). */
export function BillPaymentBadge({ collection }) {
  const status = STATUS[statusOf(collection)];
  return (
    <span className={`badge gap-1.5 ${status.badge}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} aria-hidden />
      {status.label}
    </span>
  );
}

const STRIP =
  "flex min-h-[52px] items-center gap-2 border-t border-sky-100 bg-sky-50/70 py-1.5 pl-4 pr-3 text-slate-800 active:bg-sky-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40";

function InfoValue({ label, value }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-0.5 whitespace-nowrap text-sm font-semibold tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}

/**
 * Thẻ tóm tắt đầu màn chi tiết bill trên điện thoại: loại bill, ngày, trạng thái, "Đã thu x/y người"
 * + thanh tiến độ, tổng tiền; "Thông tin Bill" (tiền sân, cầu, ghi chú) gập lại; dải bấm sang
 * từng bill con (bill chính) hoặc về bill chính (bill con).
 *
 * collection: kết quả billCollection(bill.bill_players, subBills).
 */
export default function BillDetailSummary({ bill, collection }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const isSubBill = Boolean(bill.parent_bill_id);
  const subBills = isSubBill ? [] : bill.sub_bills || [];
  const percent =
    collection.total > 0
      ? Math.round((collection.paid / collection.total) * 100)
      : 0;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="px-4 pb-3 pt-3.5">
        {/* Từ sm đầu màn (PageHeader) đã có các badge này */}
        <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:hidden">
          <span className={`badge ${isSubBill ? "badge-sky" : "badge-slate"}`}>
            {isSubBill ? "Bill con" : "Bill chính"}
          </span>
          <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
            <CalendarDays className="h-4 w-4" />
            {formatDateShort(bill.date)}
          </span>
          <BillPaymentBadge collection={collection} />
        </div>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-slate-500">Đã thu</div>
            <div className="whitespace-nowrap text-xl font-semibold tracking-tight tabular-nums text-slate-700">
              <b className="font-bold text-slate-900">{collection.paid}</b>/
              {collection.total} người
            </div>
          </div>
          <div className="min-w-0 text-right">
            <div className="text-[13px] font-medium text-slate-500">
              Tổng tiền
            </div>
            <div className="amount text-slate-900">
              {formatCurrencyRounded(bill.total_amount)}
            </div>
          </div>
        </div>
        <div
          role="progressbar"
          aria-label="Đã thu"
          aria-valuemin={0}
          aria-valuemax={collection.total}
          aria-valuenow={collection.paid}
          aria-valuetext={`${collection.paid}/${collection.total} người`}
          className="mt-2.5 h-2 overflow-hidden rounded-full bg-slate-100"
        >
          <div
            className="h-full rounded-full bg-emerald-600"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setInfoOpen((open) => !open)}
        aria-expanded={infoOpen}
        aria-controls="bill-info"
        className="flex h-11 w-full items-center justify-between border-t border-slate-100 px-4 text-sm font-medium text-slate-700 active:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40"
      >
        Thông tin Bill
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${infoOpen ? "rotate-180" : ""}`}
        />
      </button>
      {infoOpen && (
        <div id="bill-info" className="space-y-2.5 px-4 pb-3.5">
          <div className="grid grid-cols-3 gap-3">
            <InfoValue
              label="Tiền sân"
              value={formatCurrencyRounded(bill.court_total)}
            />
            <InfoValue
              label="Tiền cầu"
              value={formatCurrencyRounded(bill.total_shuttle_price)}
            />
            {isMatchSplit(bill) ? (
              <InfoValue label="Số trận" value={bill.matches?.length || 0} />
            ) : (
              <InfoValue
                label="Tiền/người"
                value={formatCurrencyRounded(
                  billPerPersonAmount(bill.bill_players, bill.total_amount),
                )}
              />
            )}
          </div>
          {(bill.bill_shuttles || []).map((shuttle, index) => (
            <div
              key={index}
              className="flex justify-between gap-3 text-sm text-slate-600"
            >
              <span className="min-w-0 break-words">
                {shuttle.shuttle_type?.name} × {shuttle.quantity}
              </span>
              <span className="flex-none tabular-nums">
                {formatCurrencyRounded(shuttle.subtotal)}
              </span>
            </div>
          ))}
          {bill.note && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <div className="mb-0.5 text-xs font-medium text-amber-800">
                Ghi chú
              </div>
              <div className="break-words text-slate-700">{bill.note}</div>
            </div>
          )}
        </div>
      )}

      {subBills.map((subBill) => (
        <Link key={subBill.id} to={`/bills/${subBill.id}`} className={STRIP}>
          <span className="badge badge-sky flex-none">Bill con</span>
          <span className="min-w-0 flex-1 break-words text-sm font-semibold leading-tight">
            #{subBill.id}
            {subBill.note ? ` — ${subBill.note}` : ""}
            <small className="block text-xs font-medium text-slate-500">
              {(subBill.bill_players || []).length} người
            </small>
          </span>
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
            {formatCurrencyRounded(subBill.total_amount)}
          </span>
          <ChevronRight className="h-[18px] w-[18px] flex-none text-sky-700" />
        </Link>
      ))}

      {isSubBill && bill.parent_bill && (
        <Link to={`/bills/${bill.parent_bill.id}`} className={STRIP}>
          <ChevronLeft className="h-[18px] w-[18px] flex-none text-sky-700" />
          <span className="badge badge-sky flex-none">Bill con của</span>
          <span className="min-w-0 flex-1 break-words text-sm font-semibold">
            Bill chính #{bill.parent_bill.id}
          </span>
          <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
            {formatCurrencyRounded(bill.parent_bill.total_amount)}
          </span>
        </Link>
      )}
    </section>
  );
}
