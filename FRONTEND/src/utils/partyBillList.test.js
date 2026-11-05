import { describe, expect, it } from "vitest";
import {
  collectPartyUnpaid,
  filterPartyBills,
  isPartyBillOverdue,
  isUnpaidParticipantOverdue,
  partyBillStatus,
  partyFilterCount,
  partyUnpaidCount,
} from "./partyBillList";

const TODAY = new Date(2026, 10, 5, 10, 0);

const p = (user_id, is_paid, share_amount = 100000, extra = {}) => ({
  id: user_id * 10,
  user_id,
  name: `Người ${user_id}`,
  is_paid,
  share_amount,
  food_amount: 0,
  paid_amount: 0,
  ...extra,
});

const bill = (id, date, participants = [], extra = {}) => ({
  id,
  date,
  name: `Tiệc ${id}`,
  participants,
  ...extra,
});

describe("partyBillStatus / partyUnpaidCount", () => {
  it("đã TT / 1 phần / chưa TT; không có người là unknown", () => {
    expect(partyBillStatus(bill(1, "2026-11-01", [p(1, true)]))).toBe("paid");
    expect(
      partyBillStatus(bill(1, "2026-11-01", [p(1, true), p(2, false)])),
    ).toBe("partial");
    expect(partyBillStatus(bill(1, "2026-11-01", [p(1, false)]))).toBe(
      "unpaid",
    );
    expect(partyBillStatus(bill(1, "2026-11-01", []))).toBe("unknown");
    expect(
      partyUnpaidCount(bill(1, "2026-11-01", [p(1, true), p(2, false)])),
    ).toBe(1);
  });
});

describe("isPartyBillOverdue", () => {
  it("quá hạn khi từ 7 ngày trước trở về trước và còn người chưa trả (đọc ngày lịch, kể cả dạng có giờ UTC)", () => {
    expect(
      isPartyBillOverdue(bill(1, "2026-10-29", [p(1, false)]), TODAY),
    ).toBe(true);
    expect(
      isPartyBillOverdue(
        bill(1, "2026-10-29T00:00:00.000000Z", [p(1, false)]),
        TODAY,
      ),
    ).toBe(true);
    expect(
      isPartyBillOverdue(bill(1, "2026-10-30", [p(1, false)]), TODAY),
    ).toBe(false);
    expect(isPartyBillOverdue(bill(1, "2026-10-01", [p(1, true)]), TODAY)).toBe(
      false,
    );
    expect(isPartyBillOverdue(bill(1, null, [p(1, false)]), TODAY)).toBe(false);
  });
});

describe("filterPartyBills", () => {
  const bills = [
    bill(1, "2026-10-01", [p(1, true)], { name: "Tất niên" }),
    bill(2, "2026-11-01", [p(1, false)], { name: "Ăn sáng sau buổi chơi" }),
    bill(3, "2026-10-20", [p(1, true), p(2, false)], { name: "Sinh nhật" }),
  ];
  const all = { date_from: "", date_to: "", status: [], name: "" };

  it("mới nhất lên đầu, không đổi mảng gốc", () => {
    expect(filterPartyBills(bills, all).map((b) => b.id)).toEqual([2, 3, 1]);
    expect(bills.map((b) => b.id)).toEqual([1, 2, 3]);
  });

  it("lọc trạng thái, khoảng ngày và tên không dấu", () => {
    expect(
      filterPartyBills(bills, { ...all, status: ["partial", "unpaid"] }).map(
        (b) => b.id,
      ),
    ).toEqual([2, 3]);
    expect(
      filterPartyBills(bills, { ...all, date_from: "2026-10-15" }).map(
        (b) => b.id,
      ),
    ).toEqual([2, 3]);
    expect(
      filterPartyBills(bills, { ...all, name: "an sang" }).map((b) => b.id),
    ).toEqual([2]);
  });
});

describe("partyFilterCount", () => {
  it("khoảng ngày tính 1, tên tiệc tính 1", () => {
    expect(partyFilterCount({ date_from: "", date_to: "", name: "" })).toBe(0);
    expect(
      partyFilterCount({ date_from: "2026-10-01", date_to: "", name: " " }),
    ).toBe(1);
    expect(
      partyFilterCount({
        date_from: "2026-10-01",
        date_to: "2026-10-31",
        name: "tiệc",
      }),
    ).toBe(2);
  });
});

describe("collectPartyUnpaid", () => {
  it("gộp theo người: tổng đã làm tròn nghìn, ngày thiếu gộp theo ngày (mới trước), người mới nợ gần nhất lên đầu", () => {
    const bills = [
      bill(5, "2026-11-01", [
        p(1, false, 343333),
        p(2, false, 100400),
        p(3, true, 500000),
      ]),
      bill(4, "2026-10-12", [p(1, false, 240000)]),
      bill(3, "2026-10-12", [p(1, false, 60000, { food_amount: 1000 })]),
      bill(2, "2026-09-01", [p(4, false, 50000, { paid_amount: 50000 })]),
      bill(1, "2026-09-01", [{ ...p(9, false), user_id: null }]),
    ];
    expect(collectPartyUnpaid(bills)).toEqual([
      {
        userId: 1,
        name: "Người 1",
        totalAmount: 343000 + 240000 + 61000,
        billCount: 3,
        unpaidDates: [
          { date: "2026-11-01", amount: 343000 },
          { date: "2026-10-12", amount: 301000 },
        ],
      },
      {
        userId: 2,
        name: "Người 2",
        totalAmount: 100000,
        billCount: 1,
        unpaidDates: [{ date: "2026-11-01", amount: 100000 }],
      },
    ]);
  });
});

describe("isUnpaidParticipantOverdue", () => {
  it("có một ngày thiếu từ 7 ngày trước", () => {
    expect(
      isUnpaidParticipantOverdue(
        { unpaidDates: [{ date: "2026-11-01" }, { date: "2026-10-29" }] },
        TODAY,
      ),
    ).toBe(true);
    expect(
      isUnpaidParticipantOverdue(
        { unpaidDates: [{ date: "2026-11-01" }] },
        TODAY,
      ),
    ).toBe(false);
    expect(isUnpaidParticipantOverdue({ unpaidDates: [] }, TODAY)).toBe(false);
  });
});
