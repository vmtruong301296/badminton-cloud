import { useState } from "react";
import { flushSync } from "react-dom";
import CurrencyInput from "../common/CurrencyInput";
import DatePicker from "../common/DatePicker";
import ActionBar from "../ui/ActionBar";
import Modal from "../ui/Modal";
import BillSummary from "./BillSummary";
import ShuttleRow, { ShuttleColumnHeads } from "./ShuttleRow";
import { CalendarDays, Check, CircleAlert, Loader, Plus } from "../ui/icons";
import { formatCurrencyRounded, formatDateShort } from "../../utils/formatters";

const COURT_PRESETS = [140000, 280000, 420000];

/**
 * Khối các phần chung của form tạo / sửa bill cầu (CreateBill, EditBill). Desktop giữ đúng
 * bố cục cũ; điện thoại (dưới sm) theo đề xuất 03 phương án A.
 */

/** Ô ngày: điện thoại in kiểu M6 "T5, 05/11" phủ lên ô ngày gốc (chạm vẫn mở lịch của máy). */
function BillDateField({ value, onChange }) {
  return (
    <div>
      <label htmlFor="bill-date" className="field-label">
        Ngày đánh *
      </label>
      <div className="relative">
        <DatePicker
          id="bill-date"
          value={value}
          onChange={onChange}
          baseClassName="field-input"
          className="peer max-sm:opacity-0"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-between gap-2 rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-900 peer-focus:border-emerald-600 peer-focus:ring-2 peer-focus:ring-emerald-600/20 sm:hidden"
        >
          <span className="truncate">{formatDateShort(value)}</span>
          <CalendarDays className="h-5 w-5 flex-none text-slate-500" />
        </div>
      </div>
    </div>
  );
}

/**
 * Thông tin cơ bản: ngày, tổng tiền sân (3 mức nhanh + gợi ý ×1000), ghi chú.
 * Điện thoại: ngày + tiền sân cùng hàng. `courtError` (M14) dưới ô tiền sân; `noteHint`: câu
 * gợi ý dưới ô ghi chú (bill con).
 */
export function BillBasicInfoCard({
  formData,
  onChange,
  courtError,
  noteHint,
}) {
  const raw = Number(formData.court_total) || 0;
  const suggestion = raw * 1000;
  const showSuggestion =
    raw > 0 && raw < 1000 && !COURT_PRESETS.includes(suggestion);

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:col-span-1">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Thông tin cơ bản
        </h2>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-[minmax(0,10fr)_minmax(0,11fr)] items-end gap-x-3 gap-y-4 sm:grid-cols-1 sm:items-stretch sm:gap-4">
          <BillDateField
            value={formData.date}
            onChange={(value) => onChange({ date: value })}
          />
          <div>
            <label htmlFor="bill-court-total" className="field-label">
              Tổng tiền sân (VND) *
            </label>
            <CurrencyInput
              id="bill-court-total"
              value={formData.court_total}
              onChange={(value) => onChange({ court_total: value })}
              placeholder="Nhập tiền sân"
              selectOnFocus
              enterKeyHint="next"
              data-next="money"
              data-field="court"
              aria-invalid={courtError ? true : undefined}
              aria-describedby={courtError ? "bill-court-total-err" : undefined}
              baseClassName="field-input"
              className="text-right sm:text-left"
            />
          </div>
          {courtError && (
            <p
              id="bill-court-total-err"
              className="field-error col-span-2 -mt-2 sm:col-span-1"
            >
              <CircleAlert />
              {courtError}
            </p>
          )}
          <div className="col-span-2 -mt-2 flex flex-wrap gap-2 sm:col-span-1">
            {COURT_PRESETS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => onChange({ court_total: amount })}
                className={`inline-flex h-11 items-center rounded-lg border px-3 text-sm font-semibold transition sm:h-9 ${
                  Number(formData.court_total) === amount
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                }`}
              >
                {amount.toLocaleString("vi-VN")}đ
              </button>
            ))}
            {showSuggestion && (
              <button
                type="button"
                onClick={() => onChange({ court_total: suggestion })}
                className="inline-flex h-11 items-center rounded-lg border border-dashed border-emerald-400 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-500 sm:h-9"
              >
                → {suggestion.toLocaleString("vi-VN")}đ
              </button>
            )}
          </div>
          <div className="col-span-2 sm:col-span-1">
            <label htmlFor="bill-note" className="field-label">
              Ghi chú
            </label>
            <textarea
              id="bill-note"
              value={formData.note}
              onChange={(e) => onChange({ note: e.target.value })}
              aria-describedby={noteHint ? "bill-note-hint" : undefined}
              className="field-input !h-auto py-2"
              rows={1}
            />
            {noteHint && (
              <p
                id="bill-note-hint"
                className="mt-1.5 text-[13px] leading-[18px] text-slate-500"
              >
                {noteHint}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Loại cầu: nút "Thêm cầu" + các hàng ShuttleRow. Điện thoại: tiêu đề cột một lần, hàng
 * ngăn bằng vạch. `quantityErrors`: { [chỉ số dòng]: câu lỗi } (M14).
 * `restoreCreditFor(shuttle)`: số quả hoàn lại khi sửa bill (màn sửa); không truyền = tạo bill.
 */
export function BillShuttlesCard({
  shuttles,
  shuttleTypes,
  typesLoading,
  quantityErrors = {},
  restoreCreditFor,
  onAdd,
  onUpdate,
  onRemove,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:col-span-2">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <h2 className="text-base font-semibold text-slate-900">Loại cầu</h2>
        <button
          type="button"
          onClick={onAdd}
          className="btn btn-primary btn-sm"
        >
          <Plus className="h-4 w-4" />
          Thêm cầu
        </button>
      </div>
      <div
        className={`p-4 sm:p-5 ${shuttles.length === 0 ? "max-sm:hidden" : ""}`}
      >
        {shuttles.length > 0 && <ShuttleColumnHeads />}
        <div className="divide-y divide-slate-100 sm:space-y-4 sm:divide-y-0">
          {shuttles.map((shuttle, index) => (
            <ShuttleRow
              key={index}
              shuttle={shuttle}
              shuttleTypes={shuttleTypes}
              typesLoading={typesLoading}
              restoreCredit={restoreCreditFor ? restoreCreditFor(shuttle) : 0}
              quantityError={quantityErrors[index]}
              fieldKey={`shuttle-${index}`}
              onUpdate={(updated) => onUpdate(index, updated)}
              onRemove={() => onRemove(index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** Nội dung nút lưu (thanh đáy, sheet tóm tắt). */
function SubmitLabel({ loading, label, busyLabel }) {
  return loading ? (
    <>
      <Loader className="h-4 w-4 animate-spin" />
      {busyLabel}
    </>
  ) : (
    <>
      <Check className="h-4 w-4" strokeWidth={2.5} />
      {label}
    </>
  );
}

/**
 * Thanh đáy điện thoại (M2): "Tổng tiền · N người" + số tiền (chạm mở sheet Tóm tắt Bill) và
 * nút lưu. Sheet có nút lưu ở chân để xem xong lưu luôn. Nút gửi form qua thuộc tính `form`
 * (sheet nằm ngoài <form>). `summaryContent`: thân sheet thay cho BillSummary (bill chia theo
 * trận).
 */
export function BillActionBar({
  formId,
  preview,
  playerCount,
  loading,
  label,
  busyLabel,
  summaryContent,
}) {
  const [summaryOpen, setSummaryOpen] = useState(false);

  // Lưu từ sheet: đóng sheet trước (đồng bộ, để sheet trả con trỏ về chỗ cũ) rồi mới gửi form,
  // nên khi còn lỗi màn đặt được con trỏ vào ô sai. Đóng trong onClick rồi để trình duyệt tự
  // gửi thì nút đã bị gỡ khỏi trang trước khi form được gửi.
  const submitFromSheet = (event) => {
    event.preventDefault();
    flushSync(() => setSummaryOpen(false));
    document.getElementById(formId)?.requestSubmit();
  };

  return (
    <>
      <ActionBar
        summary={{
          label:
            playerCount > 0 ? `Tổng tiền · ${playerCount} người` : "Tổng tiền",
          value: formatCurrencyRounded(preview?.total_amount || 0),
          onClick: preview ? () => setSummaryOpen(true) : undefined,
          ariaLabel: "Xem tóm tắt bill",
        }}
      >
        <button
          type="submit"
          form={formId}
          disabled={loading}
          className="btn btn-primary flex-1"
        >
          <SubmitLabel loading={loading} label={label} busyLabel={busyLabel} />
        </button>
      </ActionBar>
      <Modal
        isOpen={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        title="Tóm tắt Bill"
        initialFocus="panel"
        footer={
          <button
            type="submit"
            form={formId}
            disabled={loading}
            onClick={submitFromSheet}
            className="btn btn-primary w-full"
          >
            <SubmitLabel
              loading={loading}
              label={label}
              busyLabel={busyLabel}
            />
          </button>
        }
      >
        {summaryContent ?? <BillSummary preview={preview} variant="sheet" />}
      </Modal>
    </>
  );
}
