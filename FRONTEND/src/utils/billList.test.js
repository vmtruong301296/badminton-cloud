import { describe, expect, it } from "vitest";
import {
  billStatus,
  billUnpaidAmount,
  buildBillEntries,
  collectUnpaidPlayers,
  dateRangeLabel,
  groupEntriesByMonth,
  isBillOverdue,
  isPlayerOverdue,
  matchesStatusFilter,
  monthRange,
  takeEntries,
  unpaidPlayerCount,
} from "./billList";

const player = (user_id, is_paid, total_amount = 100000, extra = {}) => ({
  user_id,
  is_paid,
  total_amount,
  debt_amount: 0,
  user: { name: `Người ${user_id}` },
  ...extra,
});

const bill = (id, date, players = [], parent_bill_id = null, extra = {}) => ({
  id,
  date,
  parent_bill_id,
  bill_players: players,
  ...extra,
});

describe("billStatus", () => {
  it("đã TT khi mọi người đã trả, 1 phần khi có người trả, chưa TT khi chưa ai trả", () => {
    expect(
      billStatus(bill(1, "2026-11-04", [player(1, true), player(2, true)])),
    ).toBe("paid");
    expect(
      billStatus(bill(1, "2026-11-04", [player(1, true), player(2, false)])),
    ).toBe("partial");
    expect(billStatus(bill(1, "2026-11-04", [player(1, false)]))).toBe(
      "unpaid",
    );
  });

  it("bill chưa có người chơi là chưa TT (khớp bộ lọc cũ)", () => {
    expect(billStatus(bill(1, "2026-11-04", []))).toBe("unpaid");
    expect(billStatus({ id: 1, date: "2026-11-04" })).toBe("unpaid");
  });
});

describe("matchesStatusFilter", () => {
  const paid = bill(1, "2026-11-04", [player(1, true)]);
  const partial = bill(2, "2026-11-04", [player(1, true), player(2, false)]);
  const unpaid = bill(3, "2026-11-04", [player(1, false)]);

  it("không chọn trạng thái nào thì lấy hết", () => {
    expect(
      [paid, partial, unpaid].every((b) => matchesStatusFilter(b, [])),
    ).toBe(true);
  });

  it("lấy bill khớp một trong các trạng thái đã chọn", () => {
    const statuses = ["partial", "unpaid"];
    expect(matchesStatusFilter(paid, statuses)).toBe(false);
    expect(matchesStatusFilter(partial, statuses)).toBe(true);
    expect(matchesStatusFilter(unpaid, statuses)).toBe(true);
  });
});

describe("unpaidPlayerCount", () => {
  it("đếm người chưa trả", () => {
    expect(
      unpaidPlayerCount(
        bill(1, "2026-11-04", [
          player(1, true),
          player(2, false),
          player(3, false),
        ]),
      ),
    ).toBe(2);
    expect(unpaidPlayerCount({ id: 1 })).toBe(0);
  });
});

describe("isBillOverdue", () => {
  const today = new Date(2026, 10, 5, 10, 0, 0); // 05/11/2026 10:00 giờ máy

  it("quá hạn khi bill từ 7 ngày trước trở đi và còn người chưa trả", () => {
    expect(
      isBillOverdue(bill(1, "2026-10-29", [player(1, false)]), today),
    ).toBe(true);
    expect(
      isBillOverdue(
        bill(1, "2026-10-29T00:00:00.000000Z", [player(1, false)]),
        today,
      ),
    ).toBe(true);
    expect(
      isBillOverdue(bill(1, "2026-10-30", [player(1, false)]), today),
    ).toBe(false);
  });

  it("không quá hạn khi mọi người đã trả hoặc thiếu ngày", () => {
    expect(isBillOverdue(bill(1, "2026-10-01", [player(1, true)]), today)).toBe(
      false,
    );
    expect(isBillOverdue(bill(1, null, [player(1, false)]), today)).toBe(false);
  });
});

describe("billUnpaidAmount", () => {
  it("cộng tiền (gồm nợ cũ) đã làm tròn nghìn của từng người chưa trả", () => {
    const b = bill(1, "2026-11-04", [
      player(1, false, 80337),
      player(2, false, 80337, { debt_amount: 1500000 }),
      player(3, true, 999999),
    ]);
    // 80.000 + 1.580.000 (làm tròn từng người như khối DS chưa thanh toán)
    expect(billUnpaidAmount(b)).toBe(1660000);
  });
});

describe("buildBillEntries", () => {
  it("bill chính mới -> cũ, bill con nằm dưới bill chính, bill con mới -> cũ", () => {
    const entries = buildBillEntries([
      bill(10, "2026-10-20"),
      bill(12, "2026-11-04"),
      bill(13, "2026-11-04", [], 12),
      bill(14, "2026-11-04T00:00:00.000000Z", [], 12),
    ]);
    expect(entries.map((e) => e.bill.id)).toEqual([12, 10]);
    expect(entries[0].children.map((b) => b.id)).toEqual([14, 13]);
    expect(entries[0].orphanOf).toBeNull();
  });

  it("bill con có bill chính không nằm trong danh sách (vd bill chính đã TT) vẫn hiện, ghi bill chính", () => {
    const entries = buildBillEntries([
      bill(20, "2026-10-12", [], 19),
      bill(18, "2026-10-14"),
    ]);
    expect(entries.map((e) => e.bill.id)).toEqual([18, 20]);
    expect(entries[1]).toMatchObject({ orphanOf: 19, children: [] });
  });
});

describe("groupEntriesByMonth", () => {
  const entries = buildBillEntries([
    bill(1, "2026-11-04", [player(1, false, 95000), player(2, true)]),
    bill(2, "2026-11-04", [player(3, false, 62000)], 1),
    bill(3, "2026-11-02T00:00:00.000000Z", [player(1, true)]),
    bill(4, "2026-10-31", [player(4, false, 856400)]),
  ]);

  it("nhóm theo tháng của ngày bill, tháng mới trước", () => {
    const groups = groupEntriesByMonth(entries);
    expect(groups.map((g) => g.key)).toEqual(["2026-11", "2026-10"]);
    expect(groups[0]).toMatchObject({ year: 2026, month: 11, billCount: 2 });
    expect(groups[0].entries.map((e) => e.bill.id)).toEqual([1, 3]);
  });

  it("còn thiếu của tháng cộng cả bill con", () => {
    const groups = groupEntriesByMonth(entries);
    expect(groups[0].unpaidTotal).toBe(157000);
    expect(groups[1].unpaidTotal).toBe(856000);
  });
});

describe("takeEntries", () => {
  const entries = buildBillEntries([
    bill(1, "2026-11-04"),
    bill(2, "2026-11-02"),
    bill(3, "2026-10-31"),
    bill(4, "2026-10-28"),
  ]);
  const groups = groupEntriesByMonth(entries);

  it("cắt theo số bill hiện, giữ số liệu cả tháng ở đầu nhóm", () => {
    const visible = takeEntries(groups, 3);
    expect(visible.map((g) => g.entries.length)).toEqual([2, 1]);
    expect(visible[1].billCount).toBe(2);
  });

  it("bỏ nhóm không còn bill nào được hiện", () => {
    expect(takeEntries(groups, 2).map((g) => g.key)).toEqual(["2026-11"]);
  });
});

describe("monthRange", () => {
  const now = new Date(2026, 10, 5);

  it("tháng này và tháng trước, từ ngày 1 tới ngày cuối", () => {
    expect(monthRange(now, 0)).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
    expect(monthRange(now, -1)).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it("qua năm", () => {
    expect(monthRange(new Date(2026, 0, 15), -1)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});

describe("dateRangeLabel", () => {
  const now = new Date(2026, 10, 5);

  it("cùng năm in ngày/tháng", () => {
    expect(dateRangeLabel("2026-10-01", "2026-10-31", now)).toBe(
      "01/10 – 31/10",
    );
  });

  it("khác năm in đủ năm, thiếu một đầu thì dùng chữ cũ", () => {
    expect(dateRangeLabel("2025-12-01", "", now)).toBe("01/12/2025 – hiện tại");
    expect(dateRangeLabel("", "2026-09-15", now)).toBe("Từ đầu – 15/09");
  });
});

describe("collectUnpaidPlayers", () => {
  it("gộp theo người: tổng đã làm tròn (gồm nợ cũ), ngày thiếu mới -> cũ, gộp cùng ngày", () => {
    const players = collectUnpaidPlayers([
      bill(1, "2026-11-04", [player(7, false, 95400), player(8, true)]),
      bill(2, "2026-11-04", [player(7, false, 40000)], 1),
      bill(3, "2026-10-28", [player(7, false, 499000, { debt_amount: 1000 })]),
    ]);
    expect(players).toHaveLength(1);
    expect(players[0]).toMatchObject({
      userId: 7,
      name: "Người 7",
      totalAmount: 635000,
    });
    expect(players[0].unpaidDates).toEqual([
      { date: "2026-11-04", amount: 135000, billId: 1 },
      { date: "2026-10-28", amount: 499000, billId: 3 },
    ]);
  });

  it("ngày chỉ có bill con thì mở bill con đó", () => {
    const [p] = collectUnpaidPlayers([
      bill(5, "2026-10-12", [player(1, false, 60000)], 4),
    ]);
    expect(p.unpaidDates[0].billId).toBe(5);
  });

  it("người có ngày thiếu mới nhất lên trước; bỏ người tổng bằng 0", () => {
    const players = collectUnpaidPlayers([
      bill(1, "2026-10-01", [player(1, false, 50000)]),
      bill(2, "2026-11-01", [player(2, false, 50000), player(3, false, 0)]),
    ]);
    expect(players.map((p) => p.userId)).toEqual([2, 1]);
  });
});

describe("isPlayerOverdue", () => {
  const today = new Date(2026, 10, 5, 10, 0, 0);

  it("quá hạn khi có ngày thiếu từ 7 ngày trước trở đi", () => {
    expect(
      isPlayerOverdue(
        { unpaidDates: [{ date: "2026-11-04" }, { date: "2026-10-29" }] },
        today,
      ),
    ).toBe(true);
    expect(
      isPlayerOverdue({ unpaidDates: [{ date: "2026-11-04" }] }, today),
    ).toBe(false);
    expect(isPlayerOverdue({ unpaidDates: [] }, today)).toBe(false);
  });
});
