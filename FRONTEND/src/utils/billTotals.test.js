import { describe, expect, it } from "vitest";
import {
  billCollectedTotal,
  billPlayingTotal,
  billProfit,
  formatProfit,
  playerDueAmount,
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
