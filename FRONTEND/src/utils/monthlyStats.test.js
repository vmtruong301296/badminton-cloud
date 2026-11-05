import { describe, expect, it } from "vitest";
import {
  availableYears,
  formatMonthLabel,
  monthlyBillStats,
  periodSummary,
  shiftMonthKey,
} from "./monthlyStats";

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

const fullBill = (
  id,
  date,
  { parent = null, shuttles = [], players = [] } = {},
) => ({
  id,
  date,
  parent_bill_id: parent,
  bill_shuttles: shuttles.map(([shuttle_type_id, name, quantity]) => ({
    shuttle_type_id,
    quantity,
    shuttle_type: { name },
  })),
  bill_players: players.map(
    ([user_id, name, total_amount, debt_amount = 0]) => ({
      user_id,
      total_amount,
      debt_amount,
      user: { name },
    }),
  ),
});

describe("periodSummary", () => {
  const bills = [
    fullBill(1, "2026-11-04T00:00:00.000000Z", {
      shuttles: [
        [2, "Cầu Thành Công", 12],
        [1, "Cầu Hải Yến S100", 10],
      ],
      players: [
        [7, "Nguyễn Hoàng Bảo Ngọc Trâm Anh", 95400, 1000],
        [8, "Minh Anh", 62000],
      ],
    }),
    fullBill(2, "2026-11-04", {
      parent: 1,
      shuttles: [[1, "Cầu Hải Yến S100", 4]],
      players: [[8, "Minh Anh", 40000]],
    }),
    fullBill(3, "2026-11-02", {
      players: [
        [8, "Minh Anh", 62000],
        [9, "Thu Hà", 0],
      ],
    }),
    fullBill(4, "2026-10-31", {
      shuttles: [[1, "Cầu Hải Yến S100", 99]],
      players: [[7, "x", 1]],
    }),
  ];

  it("tháng: đếm bill chính, cộng cầu mọi bill (kể cả bill con), cầu theo tên", () => {
    const s = periodSummary(bills, { mode: "month", month: "2026-11" });
    expect(s.billCount).toBe(2);
    expect(s.totalShuttles).toBe(26);
    expect(s.shuttles).toEqual([
      { name: "Cầu Hải Yến S100", totalQuantity: 14 },
      { name: "Cầu Thành Công", totalQuantity: 12 },
    ]);
  });

  it("người chơi: chỉ bill chính, tiền làm tròn (gồm nợ cũ), nhiều tiền trước, bỏ người 0 đồng", () => {
    const s = periodSummary(bills, { mode: "month", month: "2026-11" });
    expect(s.players).toEqual([
      { name: "Minh Anh", totalAmount: 124000, billCount: 2 },
      {
        name: "Nguyễn Hoàng Bảo Ngọc Trâm Anh",
        totalAmount: 96000,
        billCount: 1,
      },
    ]);
  });

  it("năm: lấy mọi tháng của năm", () => {
    const s = periodSummary(bills, { mode: "year", year: 2026 });
    expect(s.billCount).toBe(3);
    expect(s.totalShuttles).toBe(125);
  });

  it("không có bill trong kỳ thì ra 0", () => {
    expect(periodSummary([], { mode: "month", month: "2026-11" })).toEqual({
      billCount: 0,
      shuttles: [],
      totalShuttles: 0,
      players: [],
    });
  });
});

describe("shiftMonthKey", () => {
  it("lùi / tiến tháng, qua năm", () => {
    expect(shiftMonthKey("2026-11", -1)).toBe("2026-10");
    expect(shiftMonthKey("2026-01", -1)).toBe("2025-12");
    expect(shiftMonthKey("2025-12", 1)).toBe("2026-01");
  });
});

describe("formatMonthLabel", () => {
  it("in Tháng m/yyyy, không số 0 đầu", () => {
    expect(formatMonthLabel("2026-09")).toBe("Tháng 9/2026");
  });
});

describe("availableYears", () => {
  it("các năm có bill kèm năm hiện tại, mới -> cũ", () => {
    const bills = [
      { date: "2025-12-08" },
      { date: "2026-11-04T00:00:00.000000Z" },
      { date: null },
    ];
    expect(availableYears(bills, 2026)).toEqual([2026, 2025]);
    expect(availableYears([], 2026)).toEqual([2026]);
  });
});
