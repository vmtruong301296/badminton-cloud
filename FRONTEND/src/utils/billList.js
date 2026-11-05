/**
 * Danh sách bill cầu (màn "Bill cầu"): trạng thái, quá hạn, nhóm theo tháng, "Xem thêm",
 * khoảng ngày lọc nhanh và danh sách người chưa thanh toán.
 *
 * Ngày của API là chuỗi "YYYY-MM-DD" hoặc nửa đêm UTC "YYYY-MM-DDT00:00:00.000000Z" (cast date
 * của Laravel): đọc thẳng 10 ký tự đầu là ngày lịch, không qua giờ UTC.
 */
import { roundToNearestThousand } from "./formatters";

/** Số bill chính hiện thêm mỗi lần bấm "Xem thêm" (điện thoại). */
export const BILL_PAGE_SIZE = 10;

/** Bill quá hạn: từ OVERDUE_DAYS ngày trước trở đi mà còn người chưa trả. */
const OVERDUE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const dateKey = (date) => (typeof date === "string" ? date.slice(0, 10) : "");

/** Ngày lịch (0 giờ, giờ máy) của chuỗi ngày API; null nếu không đọc được. */
const calendarDate = (date) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey(date));
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

const toIsoDate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const byDateDesc = (a, b) => {
  const diff = dateKey(b.date).localeCompare(dateKey(a.date));
  return diff !== 0 ? diff : (b.id || 0) - (a.id || 0);
};

/** "paid" khi có người và mọi người đã trả, "partial" khi có người đã trả, còn lại "unpaid". */
export function billStatus(bill) {
  const players = bill.bill_players || [];
  const paidCount = players.filter((p) => p.is_paid).length;
  if (players.length > 0 && paidCount === players.length) return "paid";
  if (paidCount > 0) return "partial";
  return "unpaid";
}

/** Bộ lọc trạng thái của danh sách: không chọn gì thì lấy hết. */
export function matchesStatusFilter(bill, statuses) {
  if (!statuses || statuses.length === 0) return true;
  return statuses.includes(billStatus(bill));
}

export function unpaidPlayerCount(bill) {
  return (bill.bill_players || []).filter((p) => !p.is_paid).length;
}

export function isBillOverdue(bill, today = new Date()) {
  const days = daysSince(bill.date, today);
  return days !== null && days >= OVERDUE_DAYS && unpaidPlayerCount(bill) > 0;
}

/** Số còn thiếu của một bill, cùng công thức khối "DS chưa thanh toán" (làm tròn từng người). */
export function billUnpaidAmount(bill) {
  return (bill.bill_players || [])
    .filter((p) => !p.is_paid)
    .reduce(
      (sum, p) =>
        sum +
        roundToNearestThousand((p.total_amount || 0) + (p.debt_amount || 0)),
      0,
    );
}

/**
 * Hàng cấp ngoài của danh sách: bill chính (mới -> cũ) kèm bill con nằm dưới. Bill con mà bill
 * chính không có trong danh sách (vd bill chính đã TT bị bộ lọc bỏ) thành hàng riêng theo ngày
 * của nó, `orphanOf` = id bill chính.
 * @returns {{ bill: object, children: object[], orphanOf: number|null }[]}
 */
export function buildBillEntries(bills) {
  const list = bills || [];
  const ids = new Set(list.map((b) => b.id));
  const childrenOf = new Map();
  const entries = [];

  list.forEach((b) => {
    if (b.parent_bill_id && ids.has(b.parent_bill_id)) {
      if (!childrenOf.has(b.parent_bill_id))
        childrenOf.set(b.parent_bill_id, []);
      childrenOf.get(b.parent_bill_id).push(b);
    } else {
      entries.push(b);
    }
  });

  return entries.sort(byDateDesc).map((b) => ({
    bill: b,
    children: (childrenOf.get(b.id) || []).sort(byDateDesc),
    orphanOf: b.parent_bill_id || null,
  }));
}

/**
 * Nhóm hàng theo tháng của ngày bill (mới -> cũ). billCount = số hàng cấp ngoài; unpaidTotal =
 * còn thiếu của cả nhóm, kể cả bill con.
 */
export function groupEntriesByMonth(entries) {
  const groups = [];
  const byKey = new Map();

  entries.forEach((entry) => {
    const key = dateKey(entry.bill.date).slice(0, 7);
    if (!byKey.has(key)) {
      const [year, month] = key.split("-").map(Number);
      const group = {
        key,
        year,
        month,
        entries: [],
        billCount: 0,
        unpaidTotal: 0,
      };
      byKey.set(key, group);
      groups.push(group);
    }
    const group = byKey.get(key);
    group.entries.push(entry);
    group.billCount += 1;
    group.unpaidTotal += [entry.bill, ...entry.children].reduce(
      (sum, b) => sum + billUnpaidAmount(b),
      0,
    );
  });

  return groups;
}

/** Chỉ giữ `limit` hàng đầu ("Xem thêm"); số liệu đầu nhóm vẫn là của cả tháng. */
export function takeEntries(groups, limit) {
  let remaining = limit;
  const visible = [];
  for (const group of groups) {
    if (remaining <= 0) break;
    const entries = group.entries.slice(0, remaining);
    remaining -= entries.length;
    visible.push({ ...group, entries });
  }
  return visible;
}

/** Khoảng ngày của tháng lệch `offset` so với tháng của `now` (0 = tháng này, -1 = tháng trước). */
export function monthRange(now, offset) {
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: toIsoDate(first), to: toIsoDate(last) };
}

/** Nhãn chip khoảng ngày đang lọc: "01/10 – 31/10"; khác năm thì in cả năm. */
export function dateRangeLabel(from, to, now = new Date()) {
  const format = (value) => {
    const d = calendarDate(value);
    if (!d) return "";
    const dayMonth = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
    return d.getFullYear() === now.getFullYear()
      ? dayMonth
      : `${dayMonth}/${d.getFullYear()}`;
  };
  return `${from ? format(from) : "Từ đầu"} – ${to ? format(to) : "hiện tại"}`;
}

/** Tiền nợ của một mục debt_details (bill chính + bill con cùng ngày). */
const debtDetailAmount = (debt) =>
  (debt.parent_amount !== null && debt.parent_amount !== undefined
    ? debt.parent_amount
    : 0) +
  (Array.isArray(debt.sub_bills)
    ? debt.sub_bills.reduce((sum, s) => sum + (s.amount || 0), 0)
    : 0);

/** Gộp các mục thiếu cùng ngày; mở bill chính của ngày đó nếu có, không thì bill đầu tiên. */
const mergeUnpaidDates = (items) => {
  const byDate = new Map();
  [...items]
    .sort((a, b) => dateKey(b.date).localeCompare(dateKey(a.date)))
    .forEach((item) => {
      const current = byDate.get(item.date);
      if (!current) {
        byDate.set(item.date, { ...item });
        return;
      }
      current.amount += item.amount;
      if (current.isSub && !item.isSub) {
        current.billId = item.billId;
        current.isSub = false;
      }
    });
  return Array.from(byDate.values()).map(({ date, amount, billId }) => ({
    date,
    amount,
    billId,
  }));
};

/**
 * "DS chưa thanh toán": mỗi người còn nợ một mục, tổng đã làm tròn nghìn từng bill (gồm nợ cũ),
 * ngày thiếu mới -> cũ (gộp cùng ngày), người có ngày thiếu mới nhất lên trước.
 * @returns {{ userId, name, totalAmount, unpaidDates: { date, amount, billId }[] }[]}
 */
export function collectUnpaidPlayers(bills) {
  const byUser = new Map();

  (bills || []).forEach((bill) => {
    (bill.bill_players || []).forEach((p) => {
      if (p.is_paid) return;
      if (!byUser.has(p.user_id)) {
        byUser.set(p.user_id, {
          userId: p.user_id,
          name: p.user?.name || "Unknown",
          totalAmount: 0,
          items: [],
        });
      }
      const entry = byUser.get(p.user_id);
      entry.totalAmount += roundToNearestThousand(
        (p.total_amount || 0) + (p.debt_amount || 0),
      );

      const isSub = Boolean(bill.parent_bill_id);
      if (bill.date && p.total_amount > 0) {
        entry.items.push({
          date: bill.date,
          amount: roundToNearestThousand(p.total_amount || 0),
          billId: bill.id,
          isSub,
        });
      }
      (Array.isArray(p.debt_details) ? p.debt_details : []).forEach((debt) => {
        const amount = debtDetailAmount(debt);
        if (debt.date && amount > 0) {
          entry.items.push({
            date: debt.date,
            amount: roundToNearestThousand(amount),
            billId: bill.id,
            isSub,
          });
        }
      });
    });
  });

  return Array.from(byUser.values())
    .map(({ items, ...rest }) => ({
      ...rest,
      unpaidDates: mergeUnpaidDates(items),
    }))
    .filter((p) => p.totalAmount > 0)
    .sort((a, b) =>
      dateKey(b.unpaidDates[0]?.date).localeCompare(
        dateKey(a.unpaidDates[0]?.date),
      ),
    );
}

/** Người có ít nhất một ngày thiếu đã quá hạn. */
export function isPlayerOverdue(player, today = new Date()) {
  return (player.unpaidDates || []).some((item) => {
    const days = daysSince(item.date, today);
    return days !== null && days >= OVERDUE_DAYS;
  });
}
