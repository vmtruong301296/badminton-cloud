import { useEffect, useRef } from "react";
import CurrencyInput from "../common/CurrencyInput";
import DatePicker from "../common/DatePicker";
import ActionBar from "../ui/ActionBar";
import { Car, Check, CircleAlert, Loader, Plus, Trash2 } from "../ui/icons";
import { formatCurrency, formatCurrencyRounded } from "../../utils/formatters";

/**
 * Các khối của form tạo / sửa bill tiệc (dùng chung CreatePartyBill, EditPartyBill). Desktop giữ
 * đúng bố cục cũ; điện thoại (dưới sm) đổi thứ tự / gọn lại bằng class đáp ứng.
 * Ô có data-next="party" thì Enter nhảy ô kế (focusNextOnEnter ở <form>): Tên → Tổng tiền tiệc →
 * từng khoản thêm; Enter ở ô tiền của khoản cuối thì thêm một khoản trống.
 */

/** Thông tin cơ bản: điện thoại Tên đứng đầu, rồi Ngày + Tổng tiền tiệc; desktop như cũ. */
export function PartyBasicInfoCard({
  form,
  onField,
  nameError,
  namePlaceholder,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-sm font-semibold text-slate-900">Thông tin cơ bản</p>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="col-span-2 sm:col-span-1 sm:order-2">
            <label htmlFor="pbc-name" className="field-label">
              Tên/Nội dung *
            </label>
            <input
              id="pbc-name"
              type="text"
              value={form.name}
              onChange={(e) => onField("name", e.target.value)}
              className="field-input"
              placeholder={namePlaceholder}
              required
              enterKeyHint="next"
              data-next="party"
              data-field="name"
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "pbc-name-err" : undefined}
            />
            {nameError && (
              <p id="pbc-name-err" className="field-error">
                <CircleAlert />
                {nameError}
              </p>
            )}
          </div>
          <div className="sm:order-1">
            <label htmlFor="pbc-date" className="field-label">
              Ngày *
            </label>
            <DatePicker
              id="pbc-date"
              value={form.date}
              onChange={(value) => onField("date", value)}
              baseClassName="field-input"
            />
          </div>
          <div className="sm:order-3">
            <label htmlFor="pbc-base" className="field-label">
              Tổng tiền tiệc *
            </label>
            <CurrencyInput
              id="pbc-base"
              value={form.base_amount}
              onChange={(value) => onField("base_amount", value)}
              baseClassName="field-input"
              enterKeyHint="next"
              data-next="party"
            />
          </div>
          <div className="col-span-2 sm:col-span-3 sm:order-4">
            <label htmlFor="pbc-note" className="field-label">
              Ghi chú
            </label>
            <textarea
              id="pbc-note"
              value={form.note}
              onChange={(e) => onField("note", e.target.value)}
              className="field-input !h-auto py-2"
              rows={1}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * Chi phí thêm: điện thoại mỗi khoản một dòng (tên · số tiền · xóa), tổng ở đầu thẻ, "Thêm" ở
 * cuối; desktop như cũ. lockedExtras: khoản do màn Thuê xe giữ (chỉ đọc, màn sửa).
 */
export function PartyExtrasCard({
  extras,
  lockedExtras = [],
  totalExtra,
  namePlaceholder,
  onUpdate,
  onAdd,
  onRemove,
}) {
  const cardRef = useRef(null);
  const focusNewRef = useRef(false);

  // Enter ở ô tiền của khoản cuối vừa thêm một khoản: đưa con trỏ vào ô tên của khoản mới.
  useEffect(() => {
    if (!focusNewRef.current) return;
    focusNewRef.current = false;
    cardRef.current
      ?.querySelector(`[data-extra-name="${extras.length - 1}"]`)
      ?.focus();
  }, [extras.length]);

  const handleAmountKeyDown = (event, index) => {
    if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
    if (index !== extras.length - 1) return; // ô kế do form xử lý
    event.preventDefault();
    event.stopPropagation();
    focusNewRef.current = true;
    onAdd();
  };

  return (
    <section
      ref={cardRef}
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
    >
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-sm font-semibold text-slate-900">Chi phí thêm</p>
        <span className="font-tabular text-sm font-semibold text-slate-900 sm:hidden">
          {formatCurrencyRounded(totalExtra)}
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="btn btn-primary btn-sm hidden sm:inline-flex"
        >
          <Plus className="h-4 w-4" />
          Thêm
        </button>
      </div>
      <div className="space-y-2.5 p-4 sm:p-5">
        {extras.length === 0 && lockedExtras.length === 0 && (
          <p className="text-xs text-slate-500">
            Chưa có chi phí phụ. Bấm "Thêm" để thêm.
          </p>
        )}
        {extras.map((extra, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-2 sm:grid-cols-12 sm:rounded-xl sm:border sm:border-slate-200 sm:bg-slate-50/60 sm:p-2.5"
          >
            <input
              type="text"
              value={extra.name}
              onChange={(e) => onUpdate(idx, "name", e.target.value)}
              placeholder={namePlaceholder}
              aria-label={`Tên chi phí ${idx + 1}`}
              enterKeyHint="next"
              data-next="party"
              data-extra-name={idx}
              className="field-input sm:col-span-6 sm:order-1"
            />
            <div className="sm:col-span-5 sm:order-2">
              <CurrencyInput
                value={extra.amount}
                onChange={(value) => onUpdate(idx, "amount", value)}
                baseClassName="field-input"
                className="text-right sm:text-left"
                aria-label={`Số tiền chi phí ${idx + 1}`}
                placeholder="0"
                selectOnFocus
                enterKeyHint="next"
                data-next="party"
                onKeyDown={(e) => handleAmountKeyDown(e, idx)}
              />
            </div>
            <button
              type="button"
              onClick={() => onRemove(idx)}
              aria-label="Xóa chi phí"
              className="btn btn-danger-soft btn-icon w-full sm:col-span-1 sm:order-3"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {lockedExtras.length > 0 && (
          <div className="mt-3 space-y-2">
            {lockedExtras.map((extra) => (
              <div
                key={extra.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm"
              >
                <span className="text-slate-700">
                  <Car className="mr-1.5 inline-block h-4 w-4 align-[-3px] text-slate-500" />
                  {extra.name}
                  <span className="text-slate-500"> · đến từ màn Thuê xe</span>
                </span>
                <span className="font-tabular font-medium text-slate-900">
                  {formatCurrency(extra.amount)}
                </span>
              </div>
            ))}
            <div className="text-xs text-slate-500">
              Sửa các khoản này ở màn Thuê xe. Chúng vẫn được tính vào tổng.
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={onAdd}
          className="btn w-full border border-dashed border-slate-300 bg-slate-50/60 text-slate-700 active:bg-slate-100 sm:hidden"
        >
          <Plus className="h-4 w-4" />
          Thêm
        </button>
      </div>
    </section>
  );
}

/** Thẻ "Tổng kết" (cột phải desktop, cuối trang điện thoại) — như cũ. */
export function PartySummaryCard({
  baseAmount,
  totalExtra,
  sumRatios,
  unitPrice,
  totalAll,
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-sm font-semibold text-emerald-700">Tổng kết</p>
      </div>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">Tổng tiền tiệc</span>
          <span className="font-tabular text-sm font-semibold text-slate-900">
            {formatCurrencyRounded(Number(baseAmount) || 0)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">Tổng chi phí thêm</span>
          <span className="font-tabular text-sm font-semibold text-slate-900">
            {formatCurrencyRounded(totalExtra)}
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-600">SUM mức tính</span>
          <span className="font-tabular text-sm font-semibold text-slate-900">
            {sumRatios}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-600">Đơn giá / mức</span>
          <span className="font-tabular text-sm font-semibold text-slate-900">
            {formatCurrencyRounded(unitPrice)}
          </span>
        </div>
        <div className="rounded-xl bg-emerald-50/70 p-3">
          <div className="text-xs font-medium text-emerald-700">Tổng cộng</div>
          <div className="font-display font-tabular mt-1 text-2xl font-semibold text-emerald-700">
            {formatCurrencyRounded(totalAll)}
          </div>
        </div>
      </div>
    </section>
  );
}

const savingLabel = (
  <>
    <Loader className="h-4 w-4 animate-spin" />
    Đang lưu…
  </>
);

/** Nút Hủy + lưu ở cuối form (desktop, như cũ). */
export function PartyFormDesktopActions({ saving, submitLabel, onCancel }) {
  return (
    <div className="hidden sm:flex sm:justify-end sm:gap-3">
      <button
        type="button"
        onClick={onCancel}
        className="btn btn-secondary px-5"
      >
        Hủy
      </button>
      <button type="submit" disabled={saving} className="btn btn-primary px-6">
        {saving ? (
          savingLabel
        ) : (
          <>
            <Check className="h-4 w-4" />
            {submitLabel}
          </>
        )}
      </button>
    </div>
  );
}

/** Thanh dưới điện thoại (M2): "Tổng cộng · N người" + nút lưu; Hủy = nút ‹ trên thanh trên. */
export function PartyFormActionBar({
  formId,
  saving,
  submitLabel,
  totalAll,
  peopleCount,
}) {
  return (
    <ActionBar
      summary={{
        label: `Tổng cộng · ${peopleCount} người`,
        value: (
          <span className="text-emerald-700">
            {formatCurrencyRounded(totalAll)}
          </span>
        ),
      }}
    >
      <button
        type="submit"
        form={formId}
        disabled={saving}
        className="btn btn-primary flex-1"
      >
        {saving ? (
          savingLabel
        ) : (
          <>
            <Check className="h-4 w-4" />
            {submitLabel}
          </>
        )}
      </button>
    </ActionBar>
  );
}
