/**
 * Tìm và sắp người chơi trong ô chọn người (bill cầu: PlayerSelector / PlayerPickerSheet;
 * bill tiệc dùng lại sheet). Hàm thuần, không đổi mảng truyền vào.
 */

/** Bỏ dấu tiếng Việt (kể cả đ / Đ). */
export const removeVietnameseTones = (str = "") =>
  str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

/** Chuỗi so khớp: chữ thường, bỏ dấu, gộp khoảng trắng. */
export const normalizeSearch = (str) =>
  removeVietnameseTones(String(str ?? "").toLowerCase())
    .replace(/\s+/g, " ")
    .trim();

/** Gõ không dấu vẫn khớp tên có dấu; ô tìm trống thì mọi tên đều khớp. */
export const matchesPlayerSearch = (name, query) => {
  const q = normalizeSearch(query);
  if (!q) return true;
  return normalizeSearch(name).includes(q);
};

/**
 * Danh sách hiện trong sheet, giữ thứ tự `players`.
 * - Có gõ: mọi người khớp tên (gồm cả người đã chọn — hàng không biến mất khi tick).
 * - Chưa gõ, có `scopeIds` (bill con): chỉ người của bill chính, cộng `includeIds` (người đang
 *   chọn) để người chọn thêm ngoài bill chính vẫn thấy được.
 */
export const filterPickerPlayers = (
  players = [],
  { query = "", scopeIds = null, includeIds = [] } = {},
) => {
  if (normalizeSearch(query)) {
    return players.filter((p) => matchesPlayerSearch(p.name, query));
  }
  if (!scopeIds) return [...players];
  const visible = new Set([...scopeIds, ...includeIds]);
  return players.filter((p) => visible.has(p.id));
};

/**
 * Người đã chọn lúc mở sheet lên đầu, còn lại giữ thứ tự API (số bill giảm dần).
 * Màn giữ thứ tự này tới khi đóng sheet để hàng không chạy dưới ngón tay.
 */
export const orderPickerPlayers = (players = [], pinnedIds = []) => {
  const pinned = new Set(pinnedIds);
  return [
    ...players.filter((p) => pinned.has(p.id)),
    ...players.filter((p) => !pinned.has(p.id)),
  ];
};

/** Người đầu tiên chưa chọn — Enter trong ô tìm chọn người này. */
export const firstUnselectedPlayer = (players = [], selectedIds = []) => {
  const selected = new Set(selectedIds);
  return players.find((p) => !selected.has(p.id)) ?? null;
};

/** Trùng tên khi thêm nhanh: bỏ hoa thường và khoảng trắng hai đầu (giữ dấu, như trước). */
export const findPlayerByName = (players = [], name = "") => {
  const key = name.trim().toLowerCase();
  return players.find((p) => (p.name || "").trim().toLowerCase() === key);
};
