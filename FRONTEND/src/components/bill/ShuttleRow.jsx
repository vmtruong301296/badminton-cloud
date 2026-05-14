import { useMemo } from "react";
import NumberInput from "../common/NumberInput";
import { formatCurrency, shuttleUnitPrice } from "../../utils/formatters";

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
      <div className="text-sm text-gray-500 py-2">Đang tải loại cầu...</div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4 sm:items-end">
      <div className="sm:col-span-5">
        <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
          Loại cầu
        </label>
        <select
          value={shuttle.shuttle_type_id || ""}
          onChange={handleTypeChange}
          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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
          <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
            Số lượng
          </label>
          <NumberInput
            value={shuttle.quantity}
            onChange={handleQuantityChange}
            min={1}
            className="w-full"
          />
        </div>
        <div className="sm:col-span-3">
          <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
            Thành tiền
          </label>
          <div className="font-tabular rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900">
            {formatCurrency(subtotal)}
          </div>
        </div>
        <div className="sm:col-span-1">
          <button
            type="button"
            onClick={onRemove}
            aria-label="Xóa loại cầu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 sm:h-10 sm:w-10"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
