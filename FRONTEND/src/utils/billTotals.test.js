import { describe, expect, it } from "vitest";
import {
  billCollectedTotal,
  billPlayingTotal,
  billProfit,
  billCollection,
  billPerPersonAmount,
  formatProfit,
  hasExtraCosts,
  playerCurrentOnlyAmount,
  playerDueAmount,
  playerSubBillLines,
  playerTotalWithSubBills,
} from "./billTotals";

const player = (total_amount, debt_amount = 0, menu_extra_total = 0) => ({
  total_amount,
  debt_amount,
  menu_extra_total,
});

// Số liệu thật bill #2678797: sân 140.000 + cầu 648.000 = 788.000, 15 người
// mỗi người 52.533 -> mỗi dòng hiện 53.000, thu thực tế 795.000.
const bill2678797 = Array.from({ length: 15 }, () => player(52533));

describe("playerDueAmount", () => {
  it("làm tròn tiền bill + nợ cũ đến nghìn, đúng số hiện trên từng dòng", () => {
    expect(playerDueAmount(player(52533))).toBe(53000);
    expect(playerDueAmount(player(71920, 40000))).toBe(112000);
  });

  it("thiếu trường thì coi như 0", () => {
    expect(playerDueAmount({})).toBe(0);
  });
});

describe("billCollectedTotal", () => {
  it("bằng tổng số tiền đã làm tròn của từng người (bill #2678797 = 795.000)", () => {
    expect(billCollectedTotal(bill2678797)).toBe(795000);
  });

  it("làm tròn có thể thấp hơn tổng thô (bill #2648790 = 823.000)", () => {
    const players = [
      ...Array.from({ length: 14 }, () => player(56190)),
      player(39333),
    ];
    expect(billCollectedTotal(players)).toBe(823000);
  });

  it("danh sách rỗng hoặc undefined trả về 0", () => {
    expect(billCollectedTotal([])).toBe(0);
    expect(billCollectedTotal(undefined)).toBe(0);
  });
});

describe("billPlayingTotal", () => {
  it("không có nợ và menu thì bằng tổng cộng", () => {
    expect(billPlayingTotal(bill2678797)).toBe(795000);
  });

  it("trừ nợ cũ và tiền menu khỏi số thu", () => {
    // 71.920 (61.920 đánh + 10.000 menu) + 40.000 nợ -> thu 112.000
    // 52.533 không nợ, không menu -> thu 53.000
    const players = [player(71920, 40000, 10000), player(52533)];
    expect(billCollectedTotal(players)).toBe(165000);
    expect(billPlayingTotal(players)).toBe(115000);
  });
});

describe("billProfit", () => {
  it("tổng tiền đánh trừ tổng tiền bill (bill #2678797: 795.000 - 788.000 = 7.000)", () => {
    expect(
      billProfit({ total_amount: 788000, bill_players: bill2678797 }),
    ).toBe(7000);
  });

  it("âm khi làm tròn thu thiếu (bill #2648790: 823.000 - 826.000)", () => {
    const players = [
      ...Array.from({ length: 14 }, () => player(56190)),
      player(39333),
    ];
    expect(
      billProfit({ total_amount: "826000.00", bill_players: players }),
    ).toBe(-3000);
  });

  it("nợ cũ và menu không tính vào lời", () => {
    const players = [player(71920, 40000, 10000), player(52533)];
    // tiền đánh 115.000 - tổng bill 114.453
    expect(billProfit({ total_amount: 114453, bill_players: players })).toBe(
      547,
    );
  });
});

describe("formatProfit", () => {
  it("lời có dấu +, lỗ có dấu -, hòa không dấu", () => {
    expect(formatProfit(7000)).toBe("+7.000\u00a0₫");
    expect(formatProfit(-3000)).toBe("-3.000\u00a0₫");
    expect(formatProfit(0)).toBe("0\u00a0₫");
  });
});

describe("hasExtraCosts", () => {
  it("có menu nước hoặc tiền cộng thêm thì hiện khối Chi phí thêm", () => {
    expect(hasExtraCosts({ bill_player_menus: [{ subtotal: 5000 }] })).toBe(true);
    expect(hasExtraCosts({ bill_player_menus: [], extra_amount: 10000 })).toBe(true);
    expect(hasExtraCosts({ extra_amount: -5000 })).toBe(true);
  });

  it("không có gì thì ẩn", () => {
    expect(hasExtraCosts({})).toBe(false);
    expect(hasExtraCosts({ bill_player_menus: [], extra_amount: 0 })).toBe(false);
    expect(hasExtraCosts({ bill_player_menus: null, extra_amount: null })).toBe(false);
  });
});

// Bill chính có bill con "Sau 9h": người 7 chơi cả hai bill, người 8 chỉ bill chính.
const subBill180 = {
  id: 180,
  note: "Sau 9h",
  bill_players: [
    { user_id: 7, total_amount: 37662, debt_amount: 0 },
    { user_id: 9, total_amount: 0, debt_amount: 0 },
  ],
};
const subBillNoNote = {
  id: 181,
  note: null,
  bill_players: [{ user_id: 7, total_amount: 20400, debt_amount: 0 }],
};
const p7 = { user_id: 7, total_amount: 75297, debt_amount: 156000 };
const p8 = { user_id: 8, total_amount: 52237, debt_amount: 0 };

describe("playerSubBillLines", () => {
  it("tiền từng bill con đã làm tròn nghìn, nhãn là ghi chú bill con", () => {
    expect(playerSubBillLines(p7, [subBill180])).toEqual([
      { id: 180, label: "Sau 9h", amount: 38000 },
    ]);
  });

  it("bill con không ghi chú thì nhãn là Bill sau", () => {
    expect(playerSubBillLines(p7, [subBillNoNote])).toEqual([
      { id: 181, label: "Bill sau", amount: 20000 },
    ]);
  });

  it("bỏ bill con người đó không chơi hoặc tiền bằng 0", () => {
    expect(playerSubBillLines(p8, [subBill180])).toEqual([]);
    expect(playerSubBillLines({ user_id: 9 }, [subBill180])).toEqual([]);
  });

  it("không có bill con thì rỗng", () => {
    expect(playerSubBillLines(p7, [])).toEqual([]);
    expect(playerSubBillLines(p7, undefined)).toEqual([]);
  });
});

describe("playerTotalWithSubBills", () => {
  it("TT + Bill sau = bill chính (gồm nợ cũ) + từng bill con, làm tròn từng số rồi cộng", () => {
    // round(75.297 + 156.000) = 231.000; Sau 9h 38.000
    expect(playerTotalWithSubBills(p7, [subBill180])).toBe(269000);
  });

  it("không có tiền bill con thì bằng số phải trả của bill", () => {
    expect(playerTotalWithSubBills(p8, [subBill180])).toBe(52000);
    expect(playerTotalWithSubBills(p8)).toBe(52000);
  });
});

describe("playerCurrentOnlyAmount", () => {
  it("chỉ bill hiện tại: tiền bill (không nợ cũ) + bill con được đánh dấu kèm", () => {
    // round(75.297) = 75.000; Sau 9h 38.000
    expect(playerCurrentOnlyAmount(p7, [subBill180])).toBe(113000);
  });

  it("bill con (không có bill con nào bên dưới) chỉ còn tiền bill", () => {
    expect(playerCurrentOnlyAmount({ total_amount: 30142, debt_amount: 52000 })).toBe(30000);
  });
});

describe("billCollection", () => {
  const players = [
    { ...p7, is_paid: false },
    { ...p8, is_paid: true },
    { user_id: 10, total_amount: 30142, debt_amount: 0, is_paid: false },
  ];

  it("đếm người đã / chưa trả và số tiền còn thiếu (gồm nợ cũ và bill con)", () => {
    expect(billCollection(players, [subBill180])).toEqual({
      total: 3,
      paid: 1,
      unpaid: 2,
      // 269.000 + 30.000
      unpaidAmount: 299000,
      // 269.000 + 52.000 + 30.000
      totalAmount: 351000,
    });
  });

  it("danh sách rỗng", () => {
    expect(billCollection([], [])).toEqual({
      total: 0,
      paid: 0,
      unpaid: 0,
      unpaidAmount: 0,
      totalAmount: 0,
    });
    expect(billCollection(undefined).total).toBe(0);
  });
});

describe("billPerPersonAmount", () => {
  it("Tiền/người = tổng tiền bill / tổng mức tính, làm tròn đồng", () => {
    // 1.430.000 / (1 + 0.7 + 0.5) = 650.000
    const players = [
      { ratio_value: "1.000" },
      { ratio_value: "0.700" },
      { ratio_value: 0.5 },
    ];
    expect(billPerPersonAmount(players, "1430000.00")).toBe(650000);
  });

  it("thiếu mức tính thì coi là 1", () => {
    expect(billPerPersonAmount([{}, { ratio_value: null }], 100001)).toBe(
      50001,
    );
  });

  it("không có người chơi thì 0", () => {
    expect(billPerPersonAmount([], 500000)).toBe(0);
    expect(billPerPersonAmount(undefined, 500000)).toBe(0);
  });
});
