import { ChevronLeft, ChevronRight } from "./icons";

/**
 * Chọn kỳ ‹ nhãn › (M12): thay ô chọn tháng / năm gốc của trình duyệt (Chrome in "November 2026").
 *
 *   <PeriodStepper
 *     label="Tháng 11/2026"
 *     onPrev={() => setMonth(shiftMonthKey(month, -1))}
 *     onNext={() => setMonth(shiftMonthKey(month, 1))}
 *     prevLabel="Tháng trước"
 *     nextLabel="Tháng sau"
 *     nextDisabled={month === currentMonth}   // › mờ ở kỳ mới nhất
 *     className="w-full sm:w-auto"
 *   />
 *
 * - Hai nút 44 px (40 px từ sm) chỉ có biểu tượng: prevLabel / nextLabel là aria-label (bắt buộc).
 * - Nhãn ở giữa đọc lại khi đổi kỳ (aria-live), có độ rộng tối thiểu để nút không nhảy chỗ.
 * - Màn tự tính kỳ trước / sau và khi nào tắt nút; component chỉ vẽ.
 */
export default function PeriodStepper({
  label,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  prevDisabled = false,
  nextDisabled = false,
  className = "",
}) {
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={onPrev}
        disabled={prevDisabled}
        aria-label={prevLabel}
        className="btn btn-secondary btn-icon flex-none"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <span
        aria-live="polite"
        className="min-w-[8.5rem] flex-1 whitespace-nowrap text-center text-base font-semibold text-slate-900 font-tabular"
      >
        {label}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={nextDisabled}
        aria-label={nextLabel}
        className="btn btn-secondary btn-icon flex-none"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
