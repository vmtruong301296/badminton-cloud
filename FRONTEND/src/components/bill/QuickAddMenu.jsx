import { useState } from "react";
import { menusApi } from "../../services/api";
import CurrencyInput from "../common/CurrencyInput";
import { findMenuByName } from "../../utils/menus";
import Modal from "../ui/Modal";
import { Plus } from "../ui/icons";

/**
 * QuickAddMenu
 * Nút + modal tạo nhanh một menu nước ngay trong form bill, khỏi phải sang màn
 * Quản lý Menu nước. Tạo xong gọi `onCreated(menu)` để màn cha chèn món mới vào
 * đầu danh sách `menus` — mọi MenuItemPicker thấy ngay, không cần reload.
 *
 * `menus` (đủ cả món đã tắt) dùng để chặn tạo trùng tên.
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

    // Trùng tên thì không tạo mới — món đang bật đã có sẵn trong dropdown,
    // món đã tắt thì bật lại thay vì tạo bản trùng
    const existing = findMenuByName(menus, name);
    if (existing) {
      alert(
        existing.is_active === false
          ? `Menu "${existing.name}" đang tắt, hãy bật lại trong Quản lý Menu nước.`
          : `Menu "${existing.name}" đã tồn tại, hãy chọn trong danh sách.`,
      );
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
        className="btn btn-secondary btn-sm whitespace-nowrap"
      >
        <Plus className="h-4 w-4" />
        Thêm nhanh menu
      </button>

      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title="Thêm nhanh menu nước"
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={closeModal}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="quick-menu-name" className="field-label">
              Tên
            </label>
            <input
              id="quick-menu-name"
              type="text"
              value={newMenu.name}
              onChange={(e) => setNewMenu({ ...newMenu, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate(e);
                }
              }}
              className="field-input"
              placeholder="Nhập tên menu nước"
            />
          </div>
          <div>
            <label htmlFor="quick-menu-price" className="field-label">
              Giá (VND)
            </label>
            <CurrencyInput
              id="quick-menu-price"
              value={newMenu.price}
              onChange={(value) => setNewMenu({ ...newMenu, price: value })}
              baseClassName="field-input"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
