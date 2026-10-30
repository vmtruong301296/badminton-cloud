import { describe, expect, it } from "vitest";
import { monthlyBillStats } from "./monthlyStats";

const bill = (id, date, shuttles = [], parent_bill_id = null) => ({
  id,
  date,
  parent_bill_id,
  bill_shuttles: shuttles.map((quantity) => ({ quantity })),
});

describe("monthlyBillStats", () => {
  it("trả đúng 12 tháng kết thúc ở tháng cuối, cũ -> mới, qua năm", () => {
    const months = monthlyBillStats([], 2026, 10);
    expect(months).toHaveLength(12);
    expect(months[0]).toMatchObject({ key: "2025-11", year: 2025, month: 11 });
    expect(months[11]).toMatchObject({ key: "2026-10", year: 2026, month: 10 });
    expect(months.every((m) => m.bills === 0 && m.shuttles === 0)).toBe(true);
  });

  it("đếm bill chính theo tháng, bill con không tính là bill riêng", () => {
    const bills = [
      bill(1, "2026-10-25T00:00:00.000000Z"),
      bill(2, "2026-10-25T00:00:00.000000Z", [], 1),
      bill(3, "2026-10-27"),
      bill(4, "2026-09-02"),
    ];
    const months = monthlyBillStats(bills, 2026, 10);
    expect(months.find((m) => m.key === "2026-10").bills).toBe(2);
    expect(months.find((m) => m.key === "2026-09").bills).toBe(1);
  });

  it("cộng cầu của mọi bill trong tháng, kể cả bill con", () => {
    const bills = [
      bill(1, "2026-10-25", [14, 12]),
      bill(2, "2026-10-25", [2], 1),
      bill(3, "2026-08-01", [5]),
    ];
    const months = monthlyBillStats(bills, 2026, 10);
    expect(months.find((m) => m.key === "2026-10").shuttles).toBe(28);
    expect(months.find((m) => m.key === "2026-08").shuttles).toBe(5);
  });

  it("bỏ qua bill ngoài khoảng 12 tháng và bill thiếu ngày", () => {
    const bills = [
      bill(1, "2025-10-31", [9]),
      bill(2, "2026-11-01", [9]),
      bill(3, null, [9]),
    ];
    const months = monthlyBillStats(bills, 2026, 10);
    expect(months.reduce((sum, m) => sum + m.bills + m.shuttles, 0)).toBe(0);
  });

  it("chế độ năm: kết thúc ở tháng 12 cho ra T1..T12", () => {
    const months = monthlyBillStats([bill(1, "2026-01-15", [3])], 2026, 12);
    expect(months.map((m) => m.month)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
    ]);
    expect(months[0]).toMatchObject({ bills: 1, shuttles: 3 });
  });
});
