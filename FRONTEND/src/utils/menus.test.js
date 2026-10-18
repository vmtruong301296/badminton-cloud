import { describe, expect, it } from "vitest";
import { findMenuByName, selectableMenus } from "./menus";

const menu = (overrides = {}) => ({
  id: 1,
  name: "Trà đá",
  price: 5000,
  is_active: true,
  ...overrides,
});

describe("selectableMenus", () => {
  it("bỏ món đã tắt, giữ nguyên thứ tự món đang bật", () => {
    const menus = [
      menu({ id: 3, name: "Revive" }),
      menu({ id: 2, name: "Sting", is_active: false }),
      menu({ id: 1, name: "Trà đá" }),
    ];

    expect(selectableMenus(menus).map((m) => m.id)).toEqual([3, 1]);
  });

  it("món chưa có trường is_active (máy chủ chưa cập nhật) coi như đang bật", () => {
    const { is_active: _omit, ...legacy } = menu();

    expect(selectableMenus([legacy])).toEqual([legacy]);
  });
});

describe("findMenuByName", () => {
  it("tìm trùng tên không phân biệt hoa thường và khoảng trắng hai đầu", () => {
    const menus = [menu({ id: 7, name: " Trà Đá " })];

    expect(findMenuByName(menus, "trà đá")?.id).toBe(7);
  });

  it("tìm cả món đã tắt để không tạo trùng", () => {
    const menus = [menu({ id: 9, name: "Sting", is_active: false })];

    expect(findMenuByName(menus, "Sting")?.id).toBe(9);
  });

  it("không trùng thì trả undefined", () => {
    expect(findMenuByName([menu()], "Revive")).toBeUndefined();
  });
});
