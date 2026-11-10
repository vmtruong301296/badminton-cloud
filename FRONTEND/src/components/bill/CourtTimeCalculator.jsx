import { useRef, useState } from "react";
import {
  COURT_BLOCK_MINUTES,
  COURT_PRICE_PER_BLOCK,
  DEFAULT_COURT_START,
  calculateCourtTimeFee,
} from "../../utils/courtTimeFee";
import { formatCurrency } from "../../utils/formatters";
import { CircleAlert, Plus, X } from "../ui/icons";

const RATE_LABEL = `${COURT_PRICE_PER_BLOCK / 1000}k / ${COURT_BLOCK_MINUTES / 60}h / sân`;

const newCourt = (key) => ({ key, start: DEFAULT_COURT_START, end: "" });

/**
 * Bảng tính tiền sân theo giờ của bill con, nằm dưới ô Tổng tiền sân. Sửa giờ hoặc xoá sân mà
 * có ít nhất một sân tính được tiền thì gọi `onTotal(tổng đã làm tròn lên nghìn)`; thêm sân
 * (chưa có giờ kết thúc) không gọi, để giữ số người dùng tự gõ. Danh sách sân chỉ nằm ở màn,
 * không lưu vào bill — mở màn sửa bill thì bảng trống, không đè tiền sân đã lưu.
 *
 * @param {{ onTotal: (total: number) => void }} props
 */
export default function CourtTimeCalculator({ onTotal }) {
  const keyRef = useRef(1);
  const [courts, setCourts] = useState(() => [newCourt(1)]);
  const result = calculateCourtTimeFee(courts);

  const commit = (next) => {
    setCourts(next);
    const { hasValid, total } = calculateCourtTimeFee(next);
    if (hasValid) onTotal(total);
  };
  const updateCourt = (key, patch) =>
    commit(courts.map((c) => (c.key === key ? { ...c, ...patch } : c)));
  const removeCourt = (key) => commit(courts.filter((c) => c.key !== key));
  const addCourt = () => {
    keyRef.current += 1;
    setCourts([...courts, newCourt(keyRef.current)]);
  };

  return (
    <div className="border-t border-slate-100 pt-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="text-sm font-medium text-slate-700">Tính theo giờ</p>
        <p className="text-[13px] text-slate-500">{RATE_LABEL}</p>
      </div>

      <ul className="space-y-3">
        {courts.map((court, index) => {
          const line = result.lines[index];
          const name = `Sân ${index + 1}`;
          const errorId = `court-time-err-${court.key}`;
          return (
            <li key={court.key}>
              <div className="flex min-h-7 items-center gap-2">
                <span className="text-sm font-semibold text-slate-900">
                  {name}
                </span>
                {line.minutes !== null && (
                  <span className="font-tabular min-w-0 flex-1 truncate text-[13px] text-slate-500">
                    {line.minutes} phút ·{" "}
                    {formatCurrency(Math.round(line.amount))}
                  </span>
                )}
                {courts.length > 1 && (
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
        Thêm sân {courts.length + 1}
      </button>

      <p
        aria-live="polite"
        className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-[13px] text-slate-600"
      >
        {result.hasValid ? (
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
          "Chọn giờ kết thúc để tính tiền sân."
        )}
      </p>
      <p className="mt-1.5 text-[13px] leading-[18px] text-slate-500">
        Sửa giờ là ô Tiền sân tự đổi theo, vẫn gõ sửa tay được.
      </p>
    </div>
  );
}
