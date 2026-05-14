import { useState } from "react";
import NumberInput from "../common/NumberInput";
import { formatCurrency } from "../../utils/formatters";

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
    <div className="border rounded-lg p-4">
      <div className="mb-3">
        <div className="grid grid-cols-12 gap-2">
          <div className="col-span-6">
            <select
              value={selectedMenuId}
              onChange={(e) => setSelectedMenuId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">Chọn menu</option>
              {menus.map((menu) => (
                <option key={menu.id} value={menu.id}>
                  {menu.name} - {formatCurrency(menu.price)}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <NumberInput
              value={quantity}
              onChange={setQuantity}
              min={1}
              className="w-full"
            />
          </div>
          <div className="col-span-3">
            <button
              type="button"
              onClick={handleAdd}
              className="w-full px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Thêm
            </button>
          </div>
        </div>
      </div>

      {player.menus && player.menus.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-medium mb-2">Menu đã chọn:</div>
          <div className="space-y-1">
            {player.menus.map((menu, index) => (
              <div
                key={index}
                className="flex justify-between items-center bg-gray-50 p-2 rounded"
              >
                <span className="text-sm">
                  {menu.name} x {menu.quantity} ={" "}
                  {formatCurrency(menu.subtotal)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="text-red-500 hover:text-red-700"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <div className="mt-2 text-sm font-medium">
            Tổng menu: {formatCurrency(menuTotal)}
          </div>
        </div>
      )}
    </div>
  );
}
