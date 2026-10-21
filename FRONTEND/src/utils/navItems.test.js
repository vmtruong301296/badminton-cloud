import { describe, expect, it } from "vitest";
import {
  NAV_ITEMS,
  filterNavItems,
  isNavItemActive,
  splitNavItems,
  toTabItems,
} from "./navItems";

const allow = (names) => (name) => names.includes(name);

const ALL_PERMISSIONS = [
  "bills.view",
  "bills.create",
  "party_bills.view",
  "party_bills.create",
  "users.view",
  "tournament_brackets.view",
  "car_rentals.view",
  "menus.view",
  "roles.view",
];

describe("filterNavItems", () => {
  it("đủ quyền thì giữ đủ 7 mục theo thứ tự", () => {
    const items = filterNavItems(NAV_ITEMS, allow(ALL_PERMISSIONS));

    expect(items.map((item) => item.label)).toEqual([
      "Bill cầu",
      "Bill tiệc",
      "Người chơi",
      "Xếp bảng",
      "Thuê xe",
      "Master",
      "Quyền",
    ]);
  });

  it("thiếu quyền thì bỏ mục", () => {
    const items = filterNavItems(
      NAV_ITEMS,
      allow(["users.view", "roles.view"]),
    );

    expect(items.map((item) => item.label)).toEqual(["Người chơi", "Quyền"]);
  });

  it("không có quyền nào thì rỗng", () => {
    expect(filterNavItems(NAV_ITEMS, () => false)).toEqual([]);
  });

  it("nhóm còn một mục con thì hạ thành link đơn của mục con", () => {
    const items = filterNavItems(NAV_ITEMS, allow(["bills.view"]));

    expect(items).toHaveLength(1);
    expect(items[0].children).toBeUndefined();
    expect(items[0].path).toBe("/");
  });

  it("nhóm còn hai mục con thì giữ nhóm với đúng các mục con được phép", () => {
    const items = filterNavItems(
      NAV_ITEMS,
      allow(["party_bills.view", "party_bills.create"]),
    );

    expect(items[0].key).toBe("party-bills");
    expect(items[0].children.map((child) => child.path)).toEqual([
      "/party-bills",
      "/party-bills/create",
    ]);
  });

  it("Master hiện khi có bất kỳ quyền master nào", () => {
    const items = filterNavItems(NAV_ITEMS, allow(["shuttles.view"]));

    expect(items.map((item) => item.path)).toEqual(["/master"]);
  });
});

describe("splitNavItems", () => {
  const make = (count) =>
    Array.from({ length: count }, (_, index) => ({ key: `k${index}` }));

  it("không quá 5 mục thì hiện hết, không có Thêm", () => {
    expect(splitNavItems(make(5))).toEqual({ primary: make(5), more: [] });
    expect(splitNavItems(make(2))).toEqual({ primary: make(2), more: [] });
  });

  it("hơn 5 mục thì 4 mục đầu + phần còn lại vào Thêm", () => {
    const { primary, more } = splitNavItems(make(7));

    expect(primary.map((item) => item.key)).toEqual(["k0", "k1", "k2", "k3"]);
    expect(more.map((item) => item.key)).toEqual(["k4", "k5", "k6"]);
  });

  it("danh sách rỗng", () => {
    expect(splitNavItems([])).toEqual({ primary: [], more: [] });
  });
});

describe("toTabItems", () => {
  it("nhóm trỏ thẳng vào trang danh sách (mục con đầu tiên)", () => {
    const items = filterNavItems(NAV_ITEMS, allow(ALL_PERMISSIONS));
    const tabs = toTabItems(items);

    expect(tabs).toHaveLength(7);
    expect(tabs[0]).toMatchObject({ label: "Bill cầu", path: "/" });
    expect(tabs[1]).toMatchObject({ label: "Bill tiệc", path: "/party-bills" });
    expect(tabs.every((tab) => !tab.children)).toBe(true);
  });

  it("mục đơn giữ nguyên", () => {
    const items = filterNavItems(NAV_ITEMS, allow(["users.view"]));

    expect(toTabItems(items)).toEqual(items);
  });
});

describe("isNavItemActive", () => {
  const find = (key) => NAV_ITEMS.find((item) => item.key === key);

  it("khớp đúng đường dẫn", () => {
    expect(isNavItemActive(find("players"), "/players")).toBe(true);
    expect(isNavItemActive(find("players"), "/roles")).toBe(false);
  });

  it("Master sáng cả ở các đường dẫn master cũ", () => {
    for (const path of [
      "/master",
      "/ratios",
      "/menus",
      "/shuttles",
      "/payment-accounts",
    ]) {
      expect(isNavItemActive(find("master"), path)).toBe(true);
    }
    expect(isNavItemActive(find("master"), "/players")).toBe(false);
  });

  it("nhóm sáng khi đang ở trang con, kể cả trang chi tiết bill", () => {
    expect(isNavItemActive(find("bills"), "/")).toBe(true);
    expect(isNavItemActive(find("bills"), "/bills/12")).toBe(true);
    expect(isNavItemActive(find("bills"), "/bills/create")).toBe(true);
    expect(isNavItemActive(find("bills"), "/party-bills")).toBe(false);
    expect(isNavItemActive(find("party-bills"), "/party-bills/7")).toBe(true);
    expect(isNavItemActive(find("party-bills"), "/")).toBe(false);
  });

  it("không bị nhầm tiền tố giống chữ", () => {
    expect(isNavItemActive(find("bills"), "/billsx")).toBe(false);
  });
});

describe("nhóm hạ cấp thành link đơn", () => {
  it("lấy nhãn và biểu tượng của nhóm, giữ đường dẫn của mục con", () => {
    const [item] = filterNavItems(NAV_ITEMS, allow(["party_bills.view"]));

    expect(item).toMatchObject({
      label: "Bill tiệc",
      icon: "utensils",
      path: "/party-bills",
    });
    expect(isNavItemActive(item, "/party-bills/7")).toBe(true);
  });
});
