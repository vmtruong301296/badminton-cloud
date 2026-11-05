/**
 * Nhóm quyền ở màn Quyền (sửa vai trò): nhãn tiếng Việt dùng lại tên mục menu và thứ tự
 * theo menu. API /permissions?grouped=1 trả nhóm theo mã a→z bằng tiếng Anh ("users" đứng
 * cuối, "payment_accounts"…), khó tìm trên điện thoại.
 */
export const PERMISSION_GROUPS = [
  { key: "bills", label: "Bill cầu" },
  { key: "party_bills", label: "Bill tiệc" },
  { key: "users", label: "Người chơi" },
  { key: "tournament_brackets", label: "Xếp bảng" },
  { key: "car_rentals", label: "Thuê xe" },
  { key: "ratios", label: "Mức tính" },
  { key: "menus", label: "Menu nước" },
  { key: "shuttles", label: "Loại cầu" },
  { key: "payment_accounts", label: "TK nhận tiền" },
  { key: "roles", label: "Quyền" },
];

// Quyền không có nhóm (giữ như giao diện cũ)
const NO_GROUP = "other";

/** Nhãn của một nhóm; nhóm lạ (backend thêm sau) giữ mã, viết hoa chữ đầu như trước. */
export function permissionGroupLabel(key) {
  const known = PERMISSION_GROUPS.find((g) => g.key === key);
  if (known) return known.label;
  return key.charAt(0).toUpperCase() + key.slice(1);
}

/**
 * Gom danh sách quyền phẳng thành [{ key, label, permissions }]: nhóm đã biết theo thứ tự
 * menu, nhóm lạ đứng sau theo thứ tự gặp; quyền trong nhóm giữ thứ tự API trả.
 */
export function groupPermissions(permissions = []) {
  const byGroup = new Map();
  for (const permission of permissions ?? []) {
    const key = permission.group || NO_GROUP;
    if (!byGroup.has(key)) byGroup.set(key, []);
    byGroup.get(key).push(permission);
  }

  const rank = (key) => {
    const index = PERMISSION_GROUPS.findIndex((g) => g.key === key);
    return index === -1 ? PERMISSION_GROUPS.length : index;
  };

  // sort ổn định: nhóm lạ cùng hạng giữ thứ tự gặp
  return [...byGroup.keys()]
    .sort((a, b) => rank(a) - rank(b))
    .map((key) => ({
      key,
      label: permissionGroupLabel(key),
      permissions: byGroup.get(key),
    }));
}
