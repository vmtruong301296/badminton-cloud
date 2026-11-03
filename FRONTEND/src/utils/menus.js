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

/**
 * Tổng chi phí thêm của một người trong form tạo / sửa bill: tiền menu nước
 * cộng tiền cộng thêm (có thể âm để trừ bớt). Máy chủ cộng y hệt vào
 * menu_extra_total.
 */
export const playerExtraTotal = (player = {}) =>
  (player.menus || []).reduce((sum, m) => sum + (Number(m.subtotal) || 0), 0) +
  (Number(player.extra_amount) || 0);
