import { useState } from "react";
import { Link } from "react-router-dom";
import { BillPaymentBadge } from "../bill/BillDetailSummary";
import { CalendarDays, Car, ChevronDown } from "../ui/icons";
import { formatCurrencyRounded, formatDateShort } from "../../utils/formatters";
import { partyBillGrandTotal } from "../../utils/partyBillTotals";

function InfoLine({ label, value, strong = false, indent = false }) {
  return (
    <div
      className={`flex items-start justify-between gap-3 ${indent ? "pl-3 text-[13px] text-slate-600" : "text-sm text-slate-600"}`}
    >
      <span className="min-w-0 break-words">{label}</span>
      <span
        className={`flex-none whitespace-nowrap tabular-nums ${strong ? "font-semibold text-slate-900" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/**
 * Thẻ tóm tắt đầu màn chi tiết bill tiệc trên điện thoại (cùng kiểu thẻ của bill cầu):
 * trạng thái, ngày, "Đã thu x/y người" + thanh tiến độ, Tổng tiệc; "Thông tin Bill" gập lại
 * (tiền tiệc, chi phí thêm từng khoản — khoản của Thuê xe có link "xem chuyến xe", tiền thêm,
 * đơn giá, ghi chú).
 *
 * collection: kết quả partyCollection(bill.participants).
 */
export default function PartyBillSummary({ bill, collection }) {
  const [infoOpen, setInfoOpen] = useState(false);
  const percent =
    collection.total > 0
      ? Math.round((collection.paid / collection.total) * 100)
      : 0;
  const foodTotal = (bill.participants || []).reduce(
    (sum, p) => sum + (Number(p.food_amount) || 0),
    0,
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="px-4 pb-3 pt-3.5">
        {/* Từ sm đầu màn (PageHeader) đã có các thông tin này */}
        <div className="mb-3 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 sm:hidden">
          <BillPaymentBadge collection={collection} />
          <span className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
            <CalendarDays className="h-4 w-4" />
            {formatDateShort(bill.date)}
          </span>
          <span className="text-[13px] text-slate-500">
            Bill tiệc #{bill.id}
          </span>
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
              Tổng tiệc
            </div>
            <div className="amount text-slate-900">
              {formatCurrencyRounded(partyBillGrandTotal(bill))}
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
        aria-controls="party-bill-info"
        className="flex h-11 w-full items-center justify-between border-t border-slate-100 px-4 text-sm font-medium text-slate-700 active:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40"
      >
        Thông tin Bill
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${infoOpen ? "rotate-180" : ""}`}
        />
      </button>
      {infoOpen && (
        <div id="party-bill-info" className="space-y-2 px-4 pb-3.5">
          <InfoLine
            label="Tiền tiệc"
            value={formatCurrencyRounded(bill.base_amount || 0)}
            strong
          />
          <InfoLine
            label="Chi phí thêm"
            value={formatCurrencyRounded(bill.total_extra || 0)}
            strong
          />
          {(bill.extras || []).map((ex) => (
            <InfoLine
              key={ex.id}
              indent
              label={
                <>
                  {ex.car_rental_comparison_id && (
                    <Car className="mr-1.5 inline-block h-4 w-4 align-[-3px] text-slate-500" />
                  )}
                  {ex.name}
                  {ex.car_rental_comparison_id && (
                    <Link
                      to="/car-rental"
                      className="-my-2.5 block py-2.5 pl-[22px] text-xs text-blue-600 underline"
                    >
                      xem chuyến xe
                    </Link>
                  )}
                </>
              }
              value={formatCurrencyRounded(ex.amount)}
            />
          ))}
          {foodTotal !== 0 && (
            <InfoLine
              label="Tiền thêm"
              value={formatCurrencyRounded(foodTotal)}
              strong
            />
          )}
          <InfoLine
            label="Đơn giá / mức"
            value={formatCurrencyRounded(bill.unit_price || 0)}
            strong
          />
          {bill.note && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
              <div className="mb-0.5 text-xs font-medium text-amber-700">
                Ghi chú
              </div>
              <div className="break-words text-slate-700">{bill.note}</div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
