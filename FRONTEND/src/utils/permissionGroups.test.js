import { describe, expect, it } from "vitest";
import { groupPermissions, permissionGroupLabel } from "./permissionGroups";

const perm = (id, group) => ({
  id,
  name: `${group}.p${id}`,
  display_name: `Quyền ${id}`,
  group,
});

describe("permissionGroupLabel", () => {
  it("dùng lại tên mục menu cho nhóm đã biết", () => {
    expect(permissionGroupLabel("bills")).toBe("Bill cầu");
    expect(permissionGroupLabel("users")).toBe("Người chơi");
    expect(permissionGroupLabel("tournament_brackets")).toBe("Xếp bảng");
    expect(permissionGroupLabel("payment_accounts")).toBe("TK nhận tiền");
  });

  it("nhóm lạ: giữ mã, viết hoa chữ đầu như trước", () => {
    expect(permissionGroupLabel("reports")).toBe("Reports");
    expect(permissionGroupLabel("other")).toBe("Other");
  });
});

describe("groupPermissions", () => {
  it("xếp nhóm theo thứ tự menu thay vì mã a→z của API", () => {
    // API sắp theo mã nhóm: bills, car_rentals, menus, party_bills, payment_accounts,
    // ratios, roles, shuttles, tournament_brackets, users
    const apiOrder = [
      "bills",
      "car_rentals",
      "menus",
      "party_bills",
      "payment_accounts",
      "ratios",
      "roles",
      "shuttles",
      "tournament_brackets",
      "users",
    ].map((g, i) => perm(i + 1, g));

    expect(groupPermissions(apiOrder).map((g) => g.label)).toEqual([
      "Bill cầu",
      "Bill tiệc",
      "Người chơi",
      "Xếp bảng",
      "Thuê xe",
      "Mức tính",
      "Menu nước",
      "Loại cầu",
      "TK nhận tiền",
      "Quyền",
    ]);
  });

  it("giữ thứ tự quyền trong nhóm như API trả", () => {
    const groups = groupPermissions([
      perm(3, "users"),
      perm(1, "bills"),
      perm(2, "users"),
    ]);
    expect(groups).toEqual([
      { key: "bills", label: "Bill cầu", permissions: [perm(1, "bills")] },
      {
        key: "users",
        label: "Người chơi",
        permissions: [perm(3, "users"), perm(2, "users")],
      },
    ]);
  });

  it("nhóm lạ đứng sau các nhóm đã biết, theo thứ tự gặp; quyền không có nhóm vào 'other'", () => {
    const groups = groupPermissions([
      perm(1, "reports"),
      { id: 2, name: "x", display_name: "Không nhóm", group: null },
      perm(3, "roles"),
    ]);
    expect(groups.map((g) => [g.key, g.label])).toEqual([
      ["roles", "Quyền"],
      ["reports", "Reports"],
      ["other", "Other"],
    ]);
  });

  it("danh sách rỗng hoặc thiếu trả mảng rỗng, không sửa mảng đầu vào", () => {
    expect(groupPermissions([])).toEqual([]);
    expect(groupPermissions(undefined)).toEqual([]);

    const input = [perm(2, "users"), perm(1, "bills")];
    const copy = input.map((p) => ({ ...p }));
    groupPermissions(input);
    expect(input).toEqual(copy);
  });
});
