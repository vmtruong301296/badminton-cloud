import { useState } from "react";
import NumberInput from "../common/NumberInput";
import { formatCurrency } from "../../utils/formatters";
import { X } from "../ui/icons";

/**
 * MenuItemPicker
 * `menus` must be passed in from the parent — fetching the list once at the
 * parent level avoids N duplicate /api/menus calls when this picker is
 * rendered per-player in a bill form.
 */
export default function MenuItemPicker({ player, onUpdate, menus = [] }) {
  const [selectedMenuId, setSelectedMenuId] = useState("");
  const [quantity, setQuantity] = useState(1);

  const handleAdd = () => {
    if (!selectedMenuId) return;

    const menu = menus.find((m) => m.id === parseInt(selectedMenuId));
    if (!menu) return;

    const newMenu = {
      menu_id: menu.id,
      name: menu.name,
      price: menu.price,
      quantity: quantity,
      subtotal: menu.price * quantity,
    };

    const updatedMenus = [...(player.menus || []), newMenu];
    onUpdate({
      ...player,
      menus: updatedMenus,
    });

    setSelectedMenuId("");
    setQuantity(1);
  };

  const handleRemove = (index) => {
    const updatedMenus = player.menus.filter((_, i) => i !== index);
    onUpdate({
      ...player,
      menus: updatedMenus,
    });
  };

  const menuTotal = (player.menus || []).reduce(
    (sum, m) => sum + m.subtotal,
    0,
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="mb-3">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-12 sm:col-span-6">
            <select
              value={selectedMenuId}
              onChange={(e) => setSelectedMenuId(e.target.value)}
              aria-label="Chọn menu"
              className="field-input"
            >
              <option value="">Chọn menu</option>
              {menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name} - {formatCurrency(menu.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-5 sm:col-span-3">
            <NumberInput
              value={quantity}
              onChange={setQuantity}
              min={1}
              aria-label="Số lượng"
              baseClassName="field-input"
            />
          </div>
          <div className="col-span-7 sm:col-span-3">
            <button
              type="button"
              onClick={handleAdd}
              className="btn btn-secondary w-full"
            >
              Thêm
            </button>
          </div>
        </div>
      </div>

      {player.menus && player.menus.length > 0 && (
        <div className="mt-3">
          <div className="mb-2 text-sm font-medium text-slate-700">
            Menu đã chọn:
          </div>
          <div className="space-y-1">
            {player.menus.map((menu, index) => (
              <div
                key={index}
                className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 py-1 pl-3 pr-1"
              >
                <span className="min-w-0 break-words text-sm text-slate-700">
                  {menu.name} x {menu.quantity} ={" "}
                  <span className="font-tabular">
                    {formatCurrency(menu.subtotal)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  aria-label={`Xóa ${menu.name}`}
                  className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 sm:h-9 sm:w-9"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="font-tabular mt-2 text-sm font-medium text-slate-900">
            Tổng menu: {formatCurrency(menuTotal)}
          </div>
        </div>
      )}
    </div>
  );
}
