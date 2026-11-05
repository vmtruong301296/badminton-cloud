import { useId, useMemo } from "react";
import CurrencyInput from "../common/CurrencyInput";
import { formatCurrency, shuttleUnitPrice } from "../../utils/formatters";
import { ChevronDown, CircleAlert, X } from "../ui/icons";

/** Cột của hàng cầu trên điện thoại: tên ▾ · số lượng · ×. Dùng chung với hàng tiêu đề cột
 *  (ShuttleColumnHeads) để hai bên thẳng cột. */
const PHONE_COLUMNS = "grid-cols-[minmax(0,1fr)_5rem_2.75rem]";

/** Tiêu đề cột "Loại cầu / Số lượng" một lần trên đầu danh sách (chỉ điện thoại). */
export function ShuttleColumnHeads() {
  return (
    <div
      aria-hidden="true"
      className={`grid ${PHONE_COLUMNS} gap-x-2 border-b border-slate-100 pb-2 text-[13px] text-slate-500 sm:hidden`}
    >
      <span className="pl-0.5">Loại cầu</span>
      <span className="pl-0.5">Số lượng</span>
    </div>
  );
}

/**
 * Điện thoại: một hàng tên ▾ · số lượng · ×, dòng phụ "Khả dụng" + thành tiền; desktop giữ
 * lưới 12 cột cũ. `quantityError` (M14) hiện dưới hàng; `fieldKey` là data-field của ô số
 * lượng để màn cuộn tới ô sai.
 *
 * @param {{
 *   shuttle: object,
 *   onUpdate: Function,
 *   onRemove: Function,
 *   restoreCredit?: number,
 *   shuttleTypes: object[],
 *   typesLoading?: boolean,
 *   quantityError?: string,
 *   fieldKey?: string,
 * }} props
 */
export default function ShuttleRow({
  shuttle,
  onUpdate,
  onRemove,
  restoreCredit = 0,
  shuttleTypes = [],
  typesLoading = false,
  quantityError,
  fieldKey,
}) {
  const uid = useId();
  const selectedType = shuttleTypes.find(
    (st) => st.id === shuttle.shuttle_type_id,
  );
  const unitPrice = shuttleUnitPrice(selectedType);

  const availableBalls = useMemo(() => {
    const stock = selectedType?.stock_quantity ?? 0;
    return stock + (restoreCredit || 0);
  }, [selectedType, restoreCredit]);

  /** Chỉ cảnh báo khi tạo bill: số lượng dòng > tồn kho hiện tại (chưa trừ bill này). */
  const overStock =
    restoreCredit === 0 &&
    selectedType &&
    shuttle.quantity > (selectedType.stock_quantity ?? 0);

  const handleTypeChange = (e) => {
    const typeId = parseInt(e.target.value, 10);
    const type = shuttleTypes.find((st) => st.id === typeId);
    onUpdate({
      ...shuttle,
      shuttle_type_id: typeId,
      price: shuttleUnitPrice(type),
    });
  };

  const handleQuantityChange = (qty) => {
    onUpdate({
      ...shuttle,
      quantity: qty,
    });
  };

  const subtotal = unitPrice * shuttle.quantity;

  if (typesLoading && shuttleTypes.length === 0) {
    return (
      <div className="text-sm text-slate-500 py-2">Đang tải loại cầu...</div>
    );
  }

  const errorId = `${uid}-qty-err`;

  return (
    <div
      className={`grid ${PHONE_COLUMNS} items-center gap-x-2 gap-y-1 py-3 last:pb-0 sm:grid-cols-12 sm:gap-4 sm:items-end sm:py-0`}
    >
      {/* Điện thoại: khối này "contents" để ô chọn và dòng Khả dụng thành ô lưới riêng */}
      <div className="contents sm:col-span-5 sm:block">
        <label htmlFor={`${uid}-type`} className="field-label max-sm:sr-only">
          Loại cầu
        </label>
        {/* Điện thoại: chỉ in tên cầu (cắt "…"), bảng chọn gốc của máy vẫn hiện đủ giá / tồn */}
        <div className="relative">
          <select
            id={`${uid}-type`}
            value={shuttle.shuttle_type_id || ""}
            onChange={handleTypeChange}
            className="field-input max-sm:appearance-none max-sm:text-transparent"
          >
            <option value="">Chọn loại cầu</option>
            {shuttleTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} — {formatCurrency(shuttleUnitPrice(type))} (tồn:{" "}
                {type.stock_quantity ?? 0} quả)
              </option>
            ))}
          </select>
          <span
            aria-hidden="true"
            className={`pointer-events-none absolute inset-y-0 left-3 right-2 flex items-center gap-1 text-base sm:hidden ${selectedType ? "text-slate-900" : "text-slate-400"}`}
          >
            <span className="min-w-0 flex-1 truncate">
              {selectedType ? selectedType.name : "Chọn loại cầu"}
            </span>
            <ChevronDown className="h-4 w-4 flex-none text-slate-500" />
          </span>
        </div>
        {selectedType && (
          <p
            className={`col-start-1 row-start-2 mt-1 text-xs sm:col-start-auto sm:row-start-auto ${overStock ? "font-medium text-amber-700" : "text-slate-500"}`}
          >
            Khả dụng: {availableBalls} quả
            {restoreCredit > 0 && (
              <span className="text-slate-500">
                {" "}
                (đã tính hoàn từ bill này)
              </span>
            )}
            {overStock && " — vượt tồn, vẫn có thể lưu nếu đồng ý"}
          </p>
        )}
      </div>
      {/* Điện thoại: SL (cột 2) + × (cột 3) cùng hàng ô chọn, thành tiền dưới SL.
          Desktop: mỗi ô là một ô của lưới 12 cột. */}
      <div className="contents">
        <div className="col-start-2 row-start-1 sm:col-span-3 sm:col-start-auto sm:row-start-auto">
          <label htmlFor={`${uid}-qty`} className="field-label max-sm:sr-only">
            Số lượng
          </label>
          {/* Gõ như ô số tiền: xoá hết thành 0 rồi nhập số mới đè lên; lưu bill
              sẽ chặn dòng 0 quả. Chạm là bôi đen cả số; Enter sang ô số lượng kế. */}
          <CurrencyInput
            id={`${uid}-qty`}
            value={shuttle.quantity}
            onChange={handleQuantityChange}
            allowNegative={false}
            selectOnFocus
            enterKeyHint="next"
            data-next="money"
            data-field={fieldKey}
            aria-invalid={quantityError ? true : undefined}
            aria-describedby={quantityError ? errorId : undefined}
            baseClassName="field-input"
            className="text-right sm:text-left"
          />
        </div>
        <div className="col-span-2 col-start-2 row-start-2 self-start sm:col-span-3 sm:col-start-auto sm:row-start-auto sm:self-auto">
          <span className="field-label hidden sm:block">Thành tiền</span>
          <div className="font-tabular mt-1 text-right text-sm font-semibold text-slate-900 sm:hidden">
            {formatCurrency(subtotal)}
          </div>
          <div className="font-tabular hidden h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 sm:flex sm:h-10 sm:text-sm">
            {formatCurrency(subtotal)}
          </div>
        </div>
        <div className="col-start-3 row-start-1 sm:col-span-1 sm:col-start-auto sm:row-start-auto">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Xóa loại cầu"
            className="btn btn-danger-soft btn-icon"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      {quantityError && (
        <p
          id={errorId}
          className="field-error col-span-3 sm:col-span-12 sm:-mt-2"
        >
          <CircleAlert />
          {quantityError}
        </p>
      )}
    </div>
  );
}
