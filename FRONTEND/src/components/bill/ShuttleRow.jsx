import { useMemo } from 'react';
import NumberInput from '../common/NumberInput';
import { formatCurrency, shuttleUnitPrice } from '../../utils/formatters';

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
  const selectedType = shuttleTypes.find((st) => st.id === shuttle.shuttle_type_id);
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
    <div className="grid grid-cols-12 gap-4 items-end">
      <div className="col-span-5">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Loại cầu
        </label>
        <select
          value={shuttle.shuttle_type_id || ''}
          onChange={handleTypeChange}
          className="w-full px-3 py-2 border border-gray-300 rounded-md"
        >
          <option value="">Chọn loại cầu</option>
          {shuttleTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} — {formatCurrency(shuttleUnitPrice(type))} (tồn: {type.stock_quantity ?? 0} quả)
            </option>
          ))}
        </select>
        {selectedType && (
          <p className={`text-xs mt-1 ${overStock ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>
            Khả dụng: {availableBalls} quả
            {restoreCredit > 0 && (
              <span className="text-gray-600"> (đã tính hoàn từ bill này)</span>
            )}
            {overStock && ' — vượt tồn, vẫn có thể lưu nếu đồng ý'}
          </p>
        )}
      </div>
      <div className="col-span-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Số lượng
        </label>
        <NumberInput
          value={shuttle.quantity}
          onChange={handleQuantityChange}
          min={1}
          className="w-full"
        />
      </div>
      <div className="col-span-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Thành tiền
        </label>
        <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md">
          {formatCurrency(subtotal)}
        </div>
      </div>
      <div className="col-span-1">
        <button
          type="button"
          onClick={onRemove}
          className="px-3 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
