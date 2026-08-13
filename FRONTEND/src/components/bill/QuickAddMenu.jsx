import { useState } from "react";
import { menusApi } from "../../services/api";
import CurrencyInput from "../common/CurrencyInput";

/**
 * QuickAddMenu
 * Nút + modal tạo nhanh một menu nước ngay trong form bill, khỏi phải sang màn
 * Quản lý Menu nước. Tạo xong gọi `onCreated(menu)` để màn cha chèn món mới vào
 * đầu danh sách `menus` — mọi MenuItemPicker thấy ngay, không cần reload.
 *
 * `menus` dùng để chặn tạo trùng tên.
 */
export default function QuickAddMenu({ menus = [], onCreated }) {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newMenu, setNewMenu] = useState({ name: "", price: 0 });

  const openModal = () => {
    setNewMenu({ name: "", price: 0 });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Ngăn event bubble lên form bill

    if (saving) return;

    const name = newMenu.name.trim();
    if (!name) {
      alert("Vui lòng nhập tên menu");
      return;
    }
    if (!newMenu.price || newMenu.price <= 0) {
      alert("Vui lòng nhập giá menu lớn hơn 0");
      return;
    }

    // Trùng tên thì không tạo mới — món cũ đã có sẵn trong dropdown để chọn
    const nameKey = name.toLowerCase();
    const existing = menus.find(
      (m) => (m.name || "").trim().toLowerCase() === nameKey,
    );
    if (existing) {
      alert(`Menu "${existing.name}" đã tồn tại, hãy chọn trong danh sách.`);
      return;
    }

    try {
      setSaving(true);
      const response = await menusApi.create({ name, price: newMenu.price });
      onCreated?.(response.data);
      closeModal();
    } catch (error) {
      console.error("Error creating menu:", error);
      alert("Không thể tạo menu mới. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700 whitespace-nowrap"
      >
        + Thêm nhanh menu
      </button>

      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Thêm nhanh menu nước
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên
                  </label>
                  <input
                    type="text"
                    value={newMenu.name}
                    onChange={(e) =>
                      setNewMenu({ ...newMenu, name: e.target.value })
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCreate(e);
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    placeholder="Nhập tên menu nước"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Giá (VND)
                  </label>
                  <CurrencyInput
                    value={newMenu.price}
                    onChange={(value) =>
                      setNewMenu({ ...newMenu, price: value })
                    }
                    className="w-full"
                  />
                </div>
                <div className="flex justify-end space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={closeModal}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-60"
                  >
                    {saving ? "Đang lưu..." : "Lưu"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
