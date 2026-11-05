import { roundToNearestThousand } from "./formatters";

/**
 * Tiền của một bill tiệc (API /party-bills/{id}) và của form tạo / sửa bill tiệc.
 * Giữ nguyên cách tính đang có ở màn chi tiết, ảnh xuất (PartyBillExport.jsx) và form.
 */

const num = (value) => Number(value) || 0;

/** "Thành tiền" của một người: chia bill + tiền thêm − đã chi (có thể âm khi ứng trước). */
export const participantBillAmount = (participant = {}) =>
  num(participant.share_amount) +
  num(participant.food_amount) -
  num(participant.paid_amount);

/** "Tổng tiền" của một người = thành tiền + nợ bill tiệc cũ, như cột Tổng tiền của ảnh xuất. */
export const participantTotalWithDebt = (participant = {}) =>
  participantBillAmount(participant) + num(participant.debt_amount);

/**
 * "Tổng tiệc" trên màn: tiền tiệc + chi phí thêm + tiền thêm của từng người.
 * Khác "Tổng tiền" của ảnh xuất (total_amount, không gồm tiền thêm) — lỗi có sẵn, giữ nguyên.
 */
export const partyBillGrandTotal = (bill = {}) =>
  num(bill.base_amount) +
  num(bill.total_extra) +
  (bill.participants || []).reduce((sum, p) => sum + num(p.food_amount), 0);

const genderOf = (participant) =>
  participant.user?.gender || participant.gender || "";

/**
 * Thứ tự người trên màn chi tiết (giữ như cũ): chưa TT lên trước, trong mỗi nhóm nam trước
 * nữ. Bấm "Đã TT" thì người đó xuống nhóm đã trả (quyết định 8).
 */
export const sortPartyParticipants = (participants = []) =>
  [...(participants || [])].sort((a, b) => {
    const aIsPaid = a.is_paid || false;
    const bIsPaid = b.is_paid || false;
    if (aIsPaid !== bIsPaid) return aIsPaid ? 1 : -1;
    const aGender = genderOf(a);
    const bGender = genderOf(b);
    if (aGender !== bGender) {
      if (aGender === "male") return -1;
      if (bGender === "male") return 1;
    }
    return 0;
  });

/**
 * Tiến độ thu tiền: số người đã / chưa trả; tiền tính theo "Tổng tiền" từng người (gồm nợ
 * cũ) đã làm tròn nghìn, để số trên thanh dưới bằng tổng các số in trên hàng.
 */
export const partyCollection = (participants = []) =>
  (participants || []).reduce(
    (acc, participant) => {
      const amount = roundToNearestThousand(
        participantTotalWithDebt(participant),
      );
      acc.total += 1;
      acc.totalAmount += amount;
      if (participant.is_paid) {
        acc.paid += 1;
      } else {
        acc.unpaid += 1;
        acc.unpaidAmount += amount;
      }
      return acc;
    },
    { total: 0, paid: 0, unpaid: 0, totalAmount: 0, unpaidAmount: 0 },
  );

const dayKey = (date) => (typeof date === "string" ? date.slice(0, 10) : date);

/** Id các bill tiệc cũ (trước ngày bill đang xem) người này còn nợ — cho "Cả bill cũ". */
export const partyOldBillIds = (participant = {}, billDate) => {
  if (!billDate) return [];
  const current = dayKey(billDate);
  return (participant.debt_details || [])
    .filter((debt) => debt.date && dayKey(debt.date) < current)
    .map((debt) => debt.bill_id)
    .filter(Boolean);
};

/** debt_details của bill tiệc → dạng hộp nợ cũ dùng chung (PayOldBillsDialog). */
export const partyDebtLines = (debtDetails = []) =>
  (debtDetails || []).map((debt) => ({
    date: debt.date,
    parent_amount: debt.amount,
    sub_bills: [],
  }));

/**
 * Xem trước của form tạo / sửa (cùng công thức màn đang dùng): đơn giá = (tiền tiệc + chi phí
 * thêm) / tổng mức, làm tròn đồng; phần chia = mức × đơn giá; thành tiền = chia + tiền thêm − đã chi.
 * lockedExtraTotal: khoản do màn Thuê xe giữ (không nằm trong form nhưng vẫn tính).
 */
export const partyBillPreview = ({
  baseAmount,
  extras = [],
  participants = [],
  lockedExtraTotal = 0,
}) => {
  const totalExtra =
    extras.reduce((sum, item) => sum + num(item.amount), 0) +
    num(lockedExtraTotal);
  const sumRatios = participants.reduce(
    (sum, p) => sum + num(p.ratio_value),
    0,
  );
  const base = num(baseAmount);
  const unitPrice =
    sumRatios > 0 ? Math.round((base + totalExtra) / sumRatios) : 0;
  return {
    totalExtra,
    sumRatios,
    unitPrice,
    totalAll: base + totalExtra,
    participants: participants.map((p) => {
      const share = Math.round(num(p.ratio_value) * unitPrice);
      return {
        ...p,
        share,
        totalAmount: share + num(p.food_amount) - num(p.paid_amount),
      };
    }),
  };
};

/**
 * Phần khác mặc định của một người trong form ("chia đều, chỉ ghi ngoại lệ"): mức tính khác 1,
 * đã chi, tiền thêm, ghi chú — để in dòng phụ trên hàng.
 */
export const participantExceptions = (participant = {}) =>
  [
    num(participant.ratio_value) !== 1 && {
      key: "ratio",
      value: num(participant.ratio_value),
    },
    num(participant.paid_amount) !== 0 && {
      key: "paid",
      value: num(participant.paid_amount),
    },
    num(participant.food_amount) !== 0 && {
      key: "food",
      value: num(participant.food_amount),
    },
    (participant.note || "").trim() !== "" && {
      key: "note",
      value: participant.note,
    },
  ].filter(Boolean);

/**
 * Dữ liệu gửi POST / PUT /party-bills (như handleSubmit cũ): bỏ khoản thiếu tên hoặc ≤ 0 và
 * người không tên. Tạo mới đặt mọi người chưa TT; màn sửa (keepPaid) giữ Đã TT.
 */
export const buildPartyBillPayload = (form, { keepPaid = false } = {}) => ({
  date: form.date,
  name: form.name,
  note: form.note,
  base_amount: num(form.base_amount),
  extras: (form.extras || [])
    .filter((x) => (x.name || "") !== "" && num(x.amount) > 0)
    .map((x) => ({ name: x.name, amount: num(x.amount) })),
  participants: (form.participants || [])
    .filter((p) => (p.name || "") !== "")
    .map((p) => ({
      user_id: p.user_id || null,
      name: p.name,
      ratio_value: num(p.ratio_value),
      paid_amount: num(p.paid_amount),
      food_amount: num(p.food_amount),
      note: p.note || "",
      is_paid: keepPaid ? p.is_paid || false : false,
    })),
});
