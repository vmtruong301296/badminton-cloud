import { roundToNearestThousand } from "./formatters";

/**
 * Danh sách bill tiệc (GET /party-bills): trạng thái, quá hạn, bộ lọc, người chưa thanh toán.
 * Chuyển nguyên từ PartyBills.jsx để dùng chung cho bảng desktop và danh sách điện thoại.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const OVERDUE_DAYS = 7;

/** Ngày lịch của "2026-10-24" hay "2026-10-24T00:00:00.000000Z" (không lệch vì UTC). */
const calendarDate = (date) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(date || ""));
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

const daysSince = (date, today) => {
  const day = calendarDate(date);
  if (!day) return null;
  const start = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
  return Math.round((start - day) / DAY_MS);
};

/** "paid" | "partial" | "unpaid" | "unknown" (chưa có người). */
export const partyBillStatus = (bill) => {
  const participants = bill.participants || [];
  const total = participants.length;
  const paid = participants.filter((p) => p.is_paid).length;
  if (total === 0) return "unknown";
  if (paid === total) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
};

export const partyUnpaidCount = (bill) =>
  (bill.participants || []).filter((p) => !p.is_paid).length;

/** Quá hạn: bill từ 7 ngày trước trở về trước mà còn người chưa trả. */
export const isPartyBillOverdue = (bill, today = new Date()) => {
  const days = daysSince(bill.date, today);
  if (days === null) return false;
  return days >= OVERDUE_DAYS && partyUnpaidCount(bill) > 0;
};

function normalize(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

/**
 * Lọc như bộ lọc cũ: khoảng ngày (so chuỗi), trạng thái, tên không dấu; mới nhất lên đầu.
 * filters: { date_from, date_to, status: [], name }.
 */
export const filterPartyBills = (bills = [], filters = {}) => {
  let data = [...(bills || [])];
  if (filters.date_from) {
    data = data.filter((b) => !b.date || b.date >= filters.date_from);
  }
  if (filters.date_to) {
    data = data.filter((b) => !b.date || b.date <= filters.date_to);
  }
  if (Array.isArray(filters.status) && filters.status.length > 0) {
    data = data.filter((b) => filters.status.includes(partyBillStatus(b)));
  }
  if (filters.name && filters.name.trim() !== "") {
    const q = normalize(filters.name.trim());
    data = data.filter((b) => normalize(b.name || "").includes(q));
  }
  data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  return data;
};

/** Số điều kiện trong sheet "Lọc" đang bật (khoảng ngày, tên tiệc) — số trên nút "Lọc". */
export const partyFilterCount = (filters = {}) =>
  (filters.date_from || filters.date_to ? 1 : 0) +
  ((filters.name || "").trim() !== "" ? 1 : 0);

/**
 * Người còn nợ bill tiệc (khối / sheet "Chưa thanh toán"): mỗi bill làm tròn nghìn rồi cộng,
 * ngày thiếu gộp theo ngày (mới trước), người có ngày thiếu gần nhất lên đầu; bỏ người tổng ≤ 0.
 * billCount: số bill tiệc người đó chưa TT (số bill sẽ được đánh dấu khi "trả hết").
 */
export const collectPartyUnpaid = (bills = []) => {
  const map = new Map();
  (bills || []).forEach((bill) => {
    (bill.participants || []).forEach((p) => {
      if (p.is_paid || !p.user_id) return;
      if (!map.has(p.user_id)) {
        map.set(p.user_id, {
          userId: p.user_id,
          name: p.name || "Unknown",
          totalAmount: 0,
          billCount: 0,
          unpaidDates: [],
        });
      }
      const data = map.get(p.user_id);
      const rounded = roundToNearestThousand(
        (p.share_amount || 0) + (p.food_amount || 0) - (p.paid_amount || 0),
      );
      data.totalAmount += rounded;
      data.billCount += 1;
      if (bill.date && rounded > 0) {
        data.unpaidDates.push({ date: bill.date, amount: rounded });
      }
    });
  });

  return Array.from(map.values())
    .map((p) => {
      const dateMap = new Map();
      p.unpaidDates.forEach((d) => {
        if (!dateMap.has(d.date))
          dateMap.set(d.date, { date: d.date, amount: 0 });
        dateMap.get(d.date).amount += d.amount;
      });
      return {
        ...p,
        unpaidDates: Array.from(dateMap.values()).sort(
          (a, b) => new Date(b.date) - new Date(a.date),
        ),
      };
    })
    .filter((p) => p.totalAmount > 0)
    .sort((a, b) => {
      const aDate = a.unpaidDates.length
        ? new Date(a.unpaidDates[0].date)
        : new Date(0);
      const bDate = b.unpaidDates.length
        ? new Date(b.unpaidDates[0].date)
        : new Date(0);
      return bDate - aDate;
    });
};

/** Người có một ngày thiếu từ 7 ngày trước trở về trước (nền rose). */
export const isUnpaidParticipantOverdue = (participant, today = new Date()) =>
  (participant.unpaidDates || []).some((d) => {
    const days = daysSince(d.date, today);
    return days !== null && days >= OVERDUE_DAYS;
  });
