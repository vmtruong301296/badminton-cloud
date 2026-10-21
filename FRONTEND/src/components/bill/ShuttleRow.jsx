import { useId, useMemo } from "react";
import NumberInput from "../common/NumberInput";
import { formatCurrency, shuttleUnitPrice } from "../../utils/formatters";
import { X } from "../ui/icons";

/**
 * @param {{
 *   shuttle: object,
 *   onUpdate: Function,
 *   onRemove: Function,
 *   restoreCredit?: number,
 *   shuttleTypes: object[],
 *   typesLoading?: boolean,
 * }} props
 */
export default function ShuttleRow({
  shuttle,
  onUpdate,
  onRemove,
  restoreCredit = 0,
  shuttleTypes = [],
  typesLoading = false,
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

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4 sm:items-end">
      <div className="sm:col-span-5">
        <label htmlFor={`${uid}-type`} className="field-label">
          Loại cầu
        </label>
        <select
          id={`${uid}-type`}
          value={shuttle.shuttle_type_id || ""}
          onChange={handleTypeChange}
          className="field-input"
        >
          <option value="">Chọn loại cầu</option>
          {shuttleTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} — {formatCurrency(shuttleUnitPrice(type))} (tồn:{" "}
              {type.stock_quantity ?? 0} quả)
            </option>
          ))}
        </select>
        {selectedType && (
          <p
            className={`mt-1 text-xs ${overStock ? "font-medium text-amber-700" : "text-slate-500"}`}
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
      {/* On mobile: SL + Thành tiền + X on one row. On desktop: each is its own grid cell. */}
      <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:contents">
        <div className="sm:col-span-3">
          <label htmlFor={`${uid}-qty`} className="field-label">
            Số lượng
          </label>
          <NumberInput
            id={`${uid}-qty`}
            value={shuttle.quantity}
            onChange={handleQuantityChange}
            min={1}
            className="field-input"
          />
        </div>
        <div className="sm:col-span-3">
          <span className="field-label">Thành tiền</span>
          <div className="font-tabular flex h-11 items-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-base text-slate-900 sm:h-10 sm:text-sm">
            {formatCurrency(subtotal)}
          </div>
        </div>
        <div className="sm:col-span-1">
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
    </div>
  );
}
