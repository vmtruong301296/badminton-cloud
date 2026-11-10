import { useEffect, useRef } from "react";
import {
  COURT_BLOCK_MINUTES,
  calculateCourtTimeFee,
  courtPriceForDate,
  newCourtRow,
} from "../../utils/courtTimeFee";
import { formatCurrency } from "../../utils/formatters";
import { CircleAlert, Plus, X } from "../ui/icons";
import useCourtPrices from "./useCourtPrices";

/** "140k / 2h / sân"; giá lẻ nghìn thì ghi đủ số. */
const rateLabel = (price) =>
  `${price % 1000 === 0 ? `${price / 1000}k` : formatCurrency(price)} / ${COURT_BLOCK_MINUTES / 60}h / sân`;

const nextKey = (rows) => Math.max(0, ...rows.map((r) => r.key)) + 1;

/**
 * Bảng tính tiền sân theo giờ của bill con, nằm dưới ô Tổng tiền sân. Các dòng sân là
 * `rows` của form (lưu kèm bill thành court_slots); đơn giá lấy từ Master → Giá sân theo
 * `date` của bill. Sửa giờ hoặc xoá sân mà có ít nhất một sân tính được tiền thì gửi kèm
 * court_total (đã làm tròn lên nghìn); thêm sân (chưa có giờ kết thúc) chỉ đổi dòng, để giữ
 * số người dùng tự gõ. Mở màn sửa bill thì hiện khung giờ đã lưu, không đè tiền sân đã lưu.
 *
 * @param {{
 *   rows: { key: number, start: string, end: string }[],
 *   date: string,
 *   onChange: (patch: { court_slots: object[], court_total?: number }) => void,
 * }} props
 */
export default function CourtTimeCalculator({ rows, date, onChange }) {
  const { prices, error: priceError } = useCourtPrices();
  const price = courtPriceForDate(prices, date);
  const priced = price !== null;
  const result = calculateCourtTimeFee(rows, price ?? 0);
  // Người dùng đổi giờ khi giá sân chưa tải xong: giá về thì tính tiền sân một lần. Mở màn sửa
  // (chưa đổi giờ) thì không tính, để giữ tiền sân đã lưu.
  const recalcWhenPricedRef = useRef(false);

  useEffect(() => {
    if (!recalcWhenPricedRef.current || price === null) return;
    recalcWhenPricedRef.current = false;
    const { hasValid, total } = calculateCourtTimeFee(rows, price);
    if (hasValid) onChange({ court_total: total });
  }, [price, rows, onChange]);

  const commit = (next, recalc) => {
    if (recalc && !priced) recalcWhenPricedRef.current = true;
    const { hasValid, total } = calculateCourtTimeFee(next, price ?? 0);
    onChange(
      recalc && priced && hasValid
        ? { court_slots: next, court_total: total }
        : { court_slots: next },
    );
  };
  const updateCourt = (key, patch) =>
    commit(
      rows.map((c) => (c.key === key ? { ...c, ...patch } : c)),
      true,
    );
  const removeCourt = (key) =>
    commit(
      rows.filter((c) => c.key !== key),
      true,
    );
  const addCourt = () => commit([...rows, newCourtRow(nextKey(rows))], false);

  // Dòng dưới bảng: tổng tiền, hoặc câu chờ / nhắc (lỗi tải giá đã báo ở đầu bảng)
  const showTotal = priced && result.hasValid;
  let notice = null;
  if (!priced && !priceError) {
    notice =
      prices === null
        ? "Đang tải giá sân…"
        : "Chưa có giá sân cho ngày này. Thêm mốc giá ở Master → Giá sân.";
  } else if (priced && !result.hasValid) {
    notice = "Chọn giờ kết thúc để tính tiền sân.";
  }

  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Tính theo giờ</p>
        {priced && (
          <p className="text-[13px] text-slate-500">{rateLabel(price)}</p>
        )}
      </div>
      {priceError && (
        <p className="field-error mb-2">
          <CircleAlert />
          {priceError}
        </p>
      )}

      <ul className="space-y-3">
        {rows.map((court, index) => {
          const line = result.lines[index];
          const name = `Sân ${index + 1}`;
          const errorId = `court-time-err-${court.key}`;
          return (
            <li key={court.key}>
              <div className="flex min-h-7 items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {name}
                </span>
                {priced && line.minutes !== null && (
                  <span className="font-tabular min-w-0 flex-1 truncate text-[13px] text-slate-500">
                    {line.minutes} phút ·{" "}
                    {formatCurrency(Math.round(line.amount))}
                  </span>
                )}
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCourt(court.key)}
                    aria-label={`Xoá ${name}`}
                    className="-mr-1.5 ml-auto inline-flex h-8 w-8 flex-none items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-rose-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
                <input
                  type="time"
                  value={court.start}
                  onChange={(e) =>
                    updateCourt(court.key, { start: e.target.value })
                  }
                  aria-label={`${name} bắt đầu`}
                  className="field-input font-tabular px-2 text-center"
                />
                <span aria-hidden="true" className="text-slate-400">
                  →
                </span>
                <input
                  type="time"
                  value={court.end}
                  onChange={(e) =>
                    updateCourt(court.key, { end: e.target.value })
                  }
                  aria-label={`${name} kết thúc`}
                  aria-invalid={line.error ? true : undefined}
                  aria-describedby={line.error ? errorId : undefined}
                  className="field-input font-tabular px-2 text-center"
                />
              </div>
              {line.error && (
                <p id={errorId} className="field-error">
                  <CircleAlert />
                  {line.error}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={addCourt}
        className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-400 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 sm:h-10"
      >
        <Plus className="h-4 w-4" />
        Thêm sân {rows.length + 1}
      </button>

      {(showTotal || notice) && (
        <p
          aria-live="polite"
          className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-[13px] text-slate-600"
        >
          {showTotal ? (
            <>
              Tổng{" "}
              {result.total !== result.exactTotal && (
                <span className="font-tabular">
                  {formatCurrency(Math.round(result.exactTotal))} → làm tròn
                  lên{" "}
                </span>
              )}
              <span className="font-tabular text-base font-bold text-emerald-700">
                {formatCurrency(result.total)}
              </span>
            </>
          ) : (
            notice
          )}
        </p>
      )}
      <p className="mt-1.5 text-[13px] leading-[18px] text-slate-500">
        Sửa giờ là ô Tiền sân tự đổi theo, vẫn gõ sửa tay được.
      </p>
    </div>
  );
}
