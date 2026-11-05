import { describe, expect, it } from "vitest";
import {
  buildPartyBillPayload,
  partyBillFormErrors,
  participantBillAmount,
  participantExceptions,
  participantTotalWithDebt,
  partyBillGrandTotal,
  partyBillPreview,
  partyCollection,
  partyDebtLines,
  partyOldBillIds,
  sortPartyParticipants,
} from "./partyBillTotals";

const person = (id, extra = {}) => ({
  id,
  user_id: id,
  name: `Người ${id}`,
  share_amount: 343333,
  food_amount: 0,
  paid_amount: 0,
  is_paid: false,
  debt_amount: 0,
  user: { gender: "male" },
  ...extra,
});

describe("participantBillAmount / participantTotalWithDebt", () => {
  it("thành tiền = chia bill + tiền thêm − đã chi; tổng tiền cộng thêm nợ cũ (như cột Tổng tiền của ảnh xuất)", () => {
    const p = person(1, {
      share_amount: 819000,
      food_amount: 150000,
      paid_amount: 2000000,
      debt_amount: 540000,
    });
    expect(participantBillAmount(p)).toBe(-1031000);
    expect(participantTotalWithDebt(p)).toBe(-491000);
  });

  it("thiếu trường hay chuỗi số vẫn tính được", () => {
    expect(participantBillAmount({ share_amount: "5000" })).toBe(5000);
    expect(participantTotalWithDebt({})).toBe(0);
  });
});

describe("partyBillGrandTotal", () => {
  it("Tổng tiệc trên màn = tiền tiệc + chi phí thêm + tiền thêm của từng người (giữ cách tính cũ)", () => {
    const bill = {
      base_amount: 4200000,
      total_extra: 950000,
      participants: [
        person(1, { food_amount: 150000 }),
        person(2, { food_amount: "90000" }),
      ],
    };
    expect(partyBillGrandTotal(bill)).toBe(5390000);
  });
});

describe("sortPartyParticipants", () => {
  it("chưa TT lên trước, trong mỗi nhóm nam trước nữ, còn lại giữ thứ tự (STT như màn cũ)", () => {
    const list = [
      person(1, { is_paid: true }),
      person(2, { user: { gender: "female" } }),
      person(3),
      person(4, { is_paid: true, user: { gender: "female" } }),
      person(5, { user: null, gender: "male" }),
    ];
    expect(sortPartyParticipants(list).map((p) => p.id)).toEqual([
      3, 5, 2, 1, 4,
    ]);
  });

  it("không đổi mảng gốc", () => {
    const list = [person(1, { is_paid: true }), person(2)];
    sortPartyParticipants(list);
    expect(list.map((p) => p.id)).toEqual([1, 2]);
  });
});

describe("partyCollection", () => {
  it("đếm người đã / chưa trả, tiền còn thu = tổng tiền (gồm nợ cũ) đã làm tròn nghìn của người chưa trả", () => {
    const list = [
      person(1, { share_amount: 343333, debt_amount: 300000 }),
      person(2, { share_amount: 343333, is_paid: true }),
      person(3, { share_amount: 343333, paid_amount: 2000000 }),
    ];
    expect(partyCollection(list)).toEqual({
      total: 3,
      paid: 1,
      unpaid: 2,
      totalAmount: 643000 + 343000 - 1657000,
      unpaidAmount: 643000 - 1657000,
    });
  });

  it("danh sách rỗng", () => {
    expect(partyCollection([])).toEqual({
      total: 0,
      paid: 0,
      unpaid: 0,
      totalAmount: 0,
      unpaidAmount: 0,
    });
  });
});

describe("partyOldBillIds", () => {
  it("chỉ lấy bill tiệc trước ngày bill đang xem, bỏ mục không có bill_id", () => {
    const p = person(1, {
      debt_amount: 540000,
      debt_details: [
        { date: "2026-10-28", amount: 300000, bill_id: 21 },
        { date: "2026-11-02", amount: 1000, bill_id: 25 },
        { date: "2026-10-12", amount: 240000, bill_id: null },
        { date: "2026-10-12", amount: 240000, bill_id: 19 },
      ],
    });
    expect(partyOldBillIds(p, "2026-11-02T00:00:00.000000Z")).toEqual([21, 19]);
  });

  it("không có ngày bill hoặc không nợ thì rỗng", () => {
    expect(partyOldBillIds(person(1), "2026-11-02")).toEqual([]);
    expect(
      partyOldBillIds(
        person(1, { debt_details: [{ date: "2026-10-01", bill_id: 3 }] }),
        null,
      ),
    ).toEqual([]);
  });
});

describe("partyDebtLines", () => {
  it("đổi debt_details của bill tiệc sang dạng hộp nợ cũ dùng chung (ngày + số tiền, không bill con)", () => {
    expect(
      partyDebtLines([{ date: "2026-10-28", amount: 300000, bill_id: 21 }]),
    ).toEqual([{ date: "2026-10-28", parent_amount: 300000, sub_bills: [] }]);
    expect(partyDebtLines(undefined)).toEqual([]);
  });
});

describe("partyBillPreview", () => {
  it("đơn giá = (tiền tiệc + chi phí thêm) / tổng mức, làm tròn đồng; thành tiền từng người như màn cũ", () => {
    const preview = partyBillPreview({
      baseAmount: 4200000,
      extras: [
        { name: "Bánh + Tôm", amount: 350000 },
        { name: "Tiền xe", amount: "600000" },
      ],
      participants: [
        { user_id: 1, ratio_value: 1, paid_amount: 2000000, food_amount: 0 },
        { user_id: 2, ratio_value: 1, paid_amount: 0, food_amount: 150000 },
        { user_id: 3, ratio_value: 1 },
      ],
    });
    expect(preview.totalExtra).toBe(950000);
    expect(preview.sumRatios).toBe(3);
    expect(preview.unitPrice).toBe(1716667);
    expect(preview.totalAll).toBe(5150000);
    expect(preview.participants.map((p) => [p.share, p.totalAmount])).toEqual([
      [1716667, -283333],
      [1716667, 1866667],
      [1716667, 1716667],
    ]);
  });

  it("khoản thêm do Thuê xe giữ (không nằm trong form) vẫn cộng vào đơn giá", () => {
    const preview = partyBillPreview({
      baseAmount: 1000000,
      extras: [],
      lockedExtraTotal: 500000,
      participants: [{ ratio_value: 1 }, { ratio_value: 0.5 }],
    });
    expect(preview.totalExtra).toBe(500000);
    expect(preview.unitPrice).toBe(1000000);
    expect(preview.participants.map((p) => p.share)).toEqual([1000000, 500000]);
  });

  it("chưa có người thì đơn giá 0", () => {
    const preview = partyBillPreview({
      baseAmount: 1000000,
      extras: [],
      participants: [],
    });
    expect(preview.unitPrice).toBe(0);
    expect(preview.totalAll).toBe(1000000);
  });
});

describe("participantExceptions", () => {
  it("chỉ ghi phần khác mặc định: mức tính khác 1, đã chi, tiền thêm, ghi chú", () => {
    expect(
      participantExceptions({
        ratio_value: 0.5,
        paid_amount: 2000000,
        food_amount: 150000,
        note: "Ứng tiền nhà hàng",
      }),
    ).toEqual([
      { key: "ratio", value: 0.5 },
      { key: "paid", value: 2000000 },
      { key: "food", value: 150000 },
      { key: "note", value: "Ứng tiền nhà hàng" },
    ]);
    expect(
      participantExceptions({
        ratio_value: "1",
        paid_amount: 0,
        food_amount: 0,
        note: "  ",
      }),
    ).toEqual([]);
  });
});

describe("buildPartyBillPayload", () => {
  const form = {
    date: "2026-11-05",
    name: "Ăn tối",
    note: "",
    base_amount: "4200000",
    extras: [
      { name: "Bánh + Tôm", amount: 350000 },
      { name: "", amount: 0 },
      { name: "Tiền xe", amount: 0 },
    ],
    participants: [
      {
        user_id: 1,
        name: "An",
        ratio_value: 1,
        paid_amount: 0,
        food_amount: 0,
        note: "",
        is_paid: true,
      },
      { user_id: 2, name: "", ratio_value: 1 },
    ],
  };

  it("bỏ khoản trống / bằng 0 và người không tên; bill mới đặt mọi người chưa TT", () => {
    const payload = buildPartyBillPayload(form);
    expect(payload.base_amount).toBe(4200000);
    expect(payload.extras).toEqual([{ name: "Bánh + Tôm", amount: 350000 }]);
    expect(payload.participants).toEqual([
      {
        user_id: 1,
        name: "An",
        ratio_value: 1,
        paid_amount: 0,
        food_amount: 0,
        note: "",
        is_paid: false,
      },
    ]);
  });

  it("màn sửa giữ trạng thái Đã TT", () => {
    const payload = buildPartyBillPayload(form, { keepPaid: true });
    expect(payload.participants[0].is_paid).toBe(true);
  });
});

describe("partyBillFormErrors", () => {
  it("báo thiếu tên (chỉ có khoảng trắng cũng là thiếu) và thiếu người, câu như alert cũ", () => {
    expect(partyBillFormErrors({ name: "  ", participants: [] })).toEqual({
      name: "Vui lòng nhập tên/nội dung tiệc",
      participants: "Vui lòng nhập ít nhất 1 người",
    });
    expect(
      partyBillFormErrors({ name: "Tiệc", participants: [{ name: "An" }] }),
    ).toEqual({ name: null, participants: null });
  });
});
