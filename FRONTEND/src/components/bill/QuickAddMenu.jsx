import { useState } from "react";
import { menusApi } from "../../services/api";
import CurrencyInput from "../common/CurrencyInput";
import ThousandHint from "../common/ThousandHint";
import { findMenuByName } from "../../utils/menus";
import Modal from "../ui/Modal";
import { CircleAlert, Plus } from "../ui/icons";

const TRIGGER_CLASS = {
  button: "btn btn-secondary btn-sm",
  // Trong thẻ người chơi đang mở (điện thoại): nút chữ emerald, cao 44 px
  link: "-mr-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-emerald-700 active:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
};

function FieldError({ id, message }) {
  if (!message) return null;
  return (
    <p id={id} className="field-error">
      <CircleAlert />
      {message}
    </p>
  );
}

/**
 * QuickAddMenu
 * Nút + modal tạo nhanh một menu nước ngay trong form bill, khỏi phải sang màn
 * Quản lý Menu nước. Tạo xong gọi `onCreated(menu)` để màn cha chèn món mới vào
 * đầu danh sách `menus` — mọi MenuItemPicker thấy ngay, không cần reload.
 *
 * `menus` (đủ cả món đã tắt) dùng để chặn tạo trùng tên.
 * `variant`: "button" (nút viền nhỏ, mặc định) | "link" (nút chữ trong thẻ người chơi).
 * Lỗi nhập / trùng tên hiện dưới ô, lỗi máy chủ hiện trong hộp (không alert).
 */
export default function QuickAddMenu({
  menus = [],
  onCreated,
  variant = "button",
}) {
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newMenu, setNewMenu] = useState({ name: "", price: 0 });
  const [errors, setErrors] = useState({});

  const openModal = () => {
    setNewMenu({ name: "", price: 0 });
    setErrors({});
    setShowModal(true);
  };

  const showFieldError = (field, message) => {
    setErrors({ [field]: message });
    document.getElementById(`quick-menu-${field}`)?.focus();
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
      showFieldError("name", "Vui lòng nhập tên menu");
      return;
    }
    if (!newMenu.price || newMenu.price <= 0) {
      showFieldError("price", "Vui lòng nhập giá menu lớn hơn 0");
      return;
    }

    // Trùng tên thì không tạo mới — món đang bật đã có sẵn trong dropdown,
    // món đã tắt thì bật lại thay vì tạo bản trùng
    const existing = findMenuByName(menus, name);
    if (existing) {
      showFieldError(
        "name",
        existing.is_active === false
          ? `Menu "${existing.name}" đang tắt, hãy bật lại trong Quản lý Menu nước.`
          : `Menu "${existing.name}" đã tồn tại, hãy chọn trong danh sách.`,
      );
      return;
    }

    try {
      setSaving(true);
      setErrors({});
      const response = await menusApi.create({ name, price: newMenu.price });
      onCreated?.(response.data);
      closeModal();
    } catch (error) {
      console.error("Error creating menu:", error);
      setErrors({ save: "Không thể tạo menu mới. Vui lòng thử lại." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className={TRIGGER_CLASS[variant] || TRIGGER_CLASS.button}
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
          {errors.save && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 flex-none" />
              {errors.save}
            </p>
          )}
          <div>
            <label htmlFor="quick-menu-name" className="field-label">
              Tên
            </label>
            <input
              id="quick-menu-name"
              type="text"
              value={newMenu.name}
              onChange={(e) => {
                setNewMenu({ ...newMenu, name: e.target.value });
                setErrors({});
              }}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "quick-menu-name-err" : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate(e);
                }
              }}
              className="field-input"
              placeholder="Nhập tên menu nước"
            />
            <FieldError id="quick-menu-name-err" message={errors.name} />
          </div>
          <div>
            <label htmlFor="quick-menu-price" className="field-label">
              Giá (VND)
            </label>
            <CurrencyInput
              id="quick-menu-price"
              value={newMenu.price}
              onChange={(value) => {
                setNewMenu({ ...newMenu, price: value });
                setErrors({});
              }}
              selectOnFocus
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={
                errors.price ? "quick-menu-price-err" : undefined
              }
              baseClassName="field-input"
            />
            <ThousandHint
              value={newMenu.price}
              onApply={(value) => setNewMenu({ ...newMenu, price: value })}
            />
            <FieldError id="quick-menu-price-err" message={errors.price} />
          </div>
        </div>
      </Modal>
    </>
  );
}
