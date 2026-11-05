import Modal from "../ui/Modal";
import { Loader } from "../ui/icons";
import { monthRange } from "../../utils/billList";

/**
 * Sheet "Lọc bill" (M5) trên điện thoại: chọn nhanh Tháng này / Tháng trước hoặc Từ ngày /
 * Đến ngày. Đổi là danh sách lọc ngay (như bộ lọc cũ); nút chân sheet ghi số kết quả rồi đóng.
 * "Xóa lọc" bỏ khoảng ngày (chip trạng thái nằm ngoài sheet, giữ nguyên).
 */
export default function BillFilterSheet({
  isOpen,
  onClose,
  dateFrom,
  dateTo,
  onChange,
  resultCount,
  loading,
}) {
  const now = new Date();
  const presets = [
    { label: "Tháng này", range: monthRange(now, 0) },
    { label: "Tháng trước", range: monthRange(now, -1) },
  ];
  const hasRange = Boolean(dateFrom || dateTo);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lọc bill"
      initialFocus="panel"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ date_from: "", date_to: "" })}
            disabled={!hasRange}
            className="btn btn-secondary flex-1"
          >
            Xóa lọc
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary flex-1"
          >
            {loading ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Đang tải...
              </>
            ) : (
              `Xem ${resultCount} bill`
            )}
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 pb-4 pt-1">
        {presets.map(({ label, range }) => {
          const active = dateFrom === range.from && dateTo === range.to;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={active}
              onClick={() =>
                onChange(
                  active
                    ? { date_from: "", date_to: "" }
                    : { date_from: range.from, date_to: range.to },
                )
              }
              className="chip"
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-3 pb-1">
        <div className="min-w-0">
          <label htmlFor="sheet-date-from" className="field-label">
            Từ ngày
          </label>
          <input
            id="sheet-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) =>
              onChange({ date_from: e.target.value, date_to: dateTo })
            }
            className="field-input min-w-0"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="sheet-date-to" className="field-label">
            Đến ngày
          </label>
          <input
            id="sheet-date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) =>
              onChange({ date_from: dateFrom, date_to: e.target.value })
            }
            className="field-input min-w-0"
          />
        </div>
      </div>
    </Modal>
  );
}
