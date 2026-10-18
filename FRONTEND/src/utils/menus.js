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

/** Giá nước đã lưu trong bill theo món: { menu_id: price_each }. */
export const billMenuPrices = (billPlayers = []) =>
  Object.fromEntries(
    billPlayers
      .flatMap((p) => p.bill_player_menus || [])
      .map((m) => [m.menu_id, m.price_each]),
  );

/**
 * Khi sửa bill: món đã có trong bill tính theo giá đã lưu (máy chủ cũng giữ giá
 * này), món chưa có mới theo giá menu hiện tại.
 */
export const withBillPrices = (menus = [], prices = {}) =>
  menus.map((m) => (m.id in prices ? { ...m, price: prices[m.id] } : m));
