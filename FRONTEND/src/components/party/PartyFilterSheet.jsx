import Modal from "../ui/Modal";

/**
 * Sheet "Lọc" bill tiệc (M5) trên điện thoại: Từ ngày / Đến ngày, Tên tiệc. Đổi là danh sách lọc
 * ngay (như bộ lọc cũ); nút chân sheet ghi số kết quả rồi đóng. "Xóa lọc" bỏ ngày + tên (chip
 * trạng thái nằm ngoài sheet, giữ nguyên). "Số bill / trang" bỏ trên điện thoại (quyết định 14).
 *
 * onChange(patch): patch là một phần của { date_from, date_to, name }.
 */
export default function PartyFilterSheet({
  isOpen,
  onClose,
  dateFrom,
  dateTo,
  name,
  onChange,
  resultCount,
}) {
  const hasFilter = Boolean(dateFrom || dateTo || (name || "").trim());

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lọc"
      initialFocus="panel"
      footer={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange({ date_from: "", date_to: "", name: "" })}
            disabled={!hasFilter}
            className="btn btn-secondary flex-1"
          >
            Xóa lọc
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-primary flex-1"
          >
            Xem {resultCount} bill
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0">
          <label htmlFor="pb-sheet-date-from" className="field-label">
            Từ ngày
          </label>
          <input
            id="pb-sheet-date-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(e) => onChange({ date_from: e.target.value })}
            className="field-input min-w-0"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="pb-sheet-date-to" className="field-label">
            Đến ngày
          </label>
          <input
            id="pb-sheet-date-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(e) => onChange({ date_to: e.target.value })}
            className="field-input min-w-0"
          />
        </div>
      </div>
      <div className="mt-4 pb-1">
        <label htmlFor="pb-sheet-name" className="field-label">
          Tên tiệc
        </label>
        <input
          id="pb-sheet-name"
          type="text"
          enterKeyHint="done"
          value={name}
          onChange={(e) => onChange({ name: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="Tìm theo tên/nội dung tiệc..."
          className="field-input"
        />
      </div>
    </Modal>
  );
}
