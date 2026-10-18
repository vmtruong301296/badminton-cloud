/**
 * Món hiện trong ô "Chọn menu" khi tạo / sửa bill: chỉ món đang bật.
 * Thiếu trường is_active (máy chủ chưa chạy migration) thì coi như bật.
 */
export const selectableMenus = (menus = []) =>
  menus.filter((m) => m.is_active !== false);

/** Món trùng tên (bỏ hoa thường, khoảng trắng hai đầu) — tính cả món đã tắt. */
export const findMenuByName = (menus = [], name = "") => {
  const key = name.trim().toLowerCase();
  return menus.find((m) => (m.name || "").trim().toLowerCase() === key);
};
