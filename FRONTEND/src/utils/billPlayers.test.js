import { describe, expect, it } from "vitest";
import {
  countBillPlayers,
  filterBillPlayers,
  oldBillIdsOf,
  sortBillPlayers,
} from "./billPlayers";

const bp = (id, { paid = false, gender = "male", debt = 0 } = {}) => ({
  id,
  user_id: id,
  is_paid: paid,
  debt_amount: debt,
  user: { name: `Người ${id}`, gender },
});

describe("sortBillPlayers", () => {
  it("chưa trả lên trước, trong mỗi nhóm nam trước nữ (giống cột TT ảnh xuất)", () => {
    const players = [
      bp(1, { paid: true, gender: "female" }),
      bp(2, { gender: "female" }),
      bp(3, { paid: true }),
      bp(4),
    ];
    expect(sortBillPlayers(players).map((p) => p.id)).toEqual([4, 2, 3, 1]);
  });

  it("giữ thứ tự gốc khi cùng nhóm và không đổi mảng truyền vào", () => {
    const players = [bp(5), bp(6), bp(7)];
    const sorted = sortBillPlayers(players);
    expect(sorted.map((p) => p.id)).toEqual([5, 6, 7]);
    expect(sorted).not.toBe(players);
  });

  it("thiếu danh sách thì trả mảng rỗng", () => {
    expect(sortBillPlayers(undefined)).toEqual([]);
  });
});

describe("countBillPlayers", () => {
  it("đếm tất cả / chưa TT / đã TT / nợ cũ", () => {
    const players = [
      bp(1, { paid: true }),
      bp(2, { debt: 156000 }),
      bp(3),
      bp(4, { paid: true, debt: 20000 }),
    ];
    expect(countBillPlayers(players)).toEqual({
      all: 4,
      unpaid: 2,
      paid: 2,
      debt: 2,
    });
  });
});

describe("filterBillPlayers", () => {
  const players = [bp(1, { paid: true }), bp(2, { debt: 156000 }), bp(3)];

  it("lọc theo chip", () => {
    expect(filterBillPlayers(players, "all").map((p) => p.id)).toEqual([
      1, 2, 3,
    ]);
    expect(filterBillPlayers(players, "unpaid").map((p) => p.id)).toEqual([
      2, 3,
    ]);
    expect(filterBillPlayers(players, "paid").map((p) => p.id)).toEqual([1]);
    expect(filterBillPlayers(players, "debt").map((p) => p.id)).toEqual([2]);
  });

  it("bộ lọc lạ thì coi như Tất cả", () => {
    expect(filterBillPlayers(players, "x")).toHaveLength(3);
  });
});

describe("oldBillIdsOf", () => {
  it("lấy id bill chính và bill con của từng khoản nợ, không trùng", () => {
    const player = {
      debt_details: [
        {
          date: "2026-10-28",
          parent_amount: 74000,
          parent_bill_id: 176,
          sub_bills: [{ note: "Sau 9h", amount: 30000, bill_id: 177 }],
        },
        {
          date: "2026-10-21",
          parent_amount: null,
          parent_bill_id: null,
          sub_bills: [
            { note: null, amount: 52000, bill_id: 172 },
            { note: "Sau 9h", amount: 30000, bill_id: 177 },
          ],
        },
      ],
    };
    expect(oldBillIdsOf(player)).toEqual([176, 177, 172]);
  });

  it("không có nợ thì rỗng", () => {
    expect(oldBillIdsOf({})).toEqual([]);
    expect(oldBillIdsOf({ debt_details: [] })).toEqual([]);
  });
});
