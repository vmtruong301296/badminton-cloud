import { roundToNearestThousand } from "./formatters";

/**
 * Số bill và số cầu theo từng tháng, cho biểu đồ ở modal Thống kê.
 *
 * - Số bill: chỉ bill chính (bill con thuộc cùng buổi, không tính là bill riêng).
 * - Số cầu: cộng bill_shuttles của mọi bill, kể cả bill con — khớp với
 *   "Tổng số lượng cầu" của cùng tháng.
 * - Tháng lấy thẳng từ chuỗi ngày "YYYY-MM-..." của API (cast date của Laravel
 *   ra nửa đêm UTC), không qua new Date() để không lệch ngày theo múi giờ.
 */

const MONTHS_IN_CHART = 12;

const monthKey = (year, month) => `${year}-${String(month).padStart(2, "0")}`;

/**
 * 12 tháng kết thúc ở (endYear, endMonth), cũ -> mới.
 * @returns {{key: string, year: number, month: number, bills: number, shuttles: number}[]}
 */
export function monthlyBillStats(bills, endYear, endMonth) {
  const months = Array.from({ length: MONTHS_IN_CHART }, (_, i) => {
    const offset = MONTHS_IN_CHART - 1 - i;
    const index = endYear * 12 + (endMonth - 1) - offset;
    const year = Math.floor(index / 12);
    const month = (index % 12) + 1;
    return { key: monthKey(year, month), year, month, bills: 0, shuttles: 0 };
  });
  const byKey = new Map(months.map((m) => [m.key, m]));

  (bills || []).forEach((bill) => {
    if (typeof bill.date !== "string") return;
    const bucket = byKey.get(bill.date.slice(0, 7));
    if (!bucket) return;

    if (!bill.parent_bill_id) bucket.bills += 1;
    (bill.bill_shuttles || []).forEach((shuttle) => {
      bucket.shuttles += Number(shuttle.quantity) || 0;
    });
  });

  return months;
}

/** Lùi / tiến `delta` tháng: shiftMonthKey("2026-01", -1) === "2025-12". */
export function shiftMonthKey(key, delta) {
  const [year, month] = key.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return monthKey(Math.floor(index / 12), (index % 12) + 1);
}

/** "2026-09" -> "Tháng 9/2026". */
export function formatMonthLabel(key) {
  const [year, month] = key.split("-").map(Number);
  return `Tháng ${month}/${year}`;
}

/** Các năm có bill, kèm năm hiện tại, mới -> cũ (cho nút ‹ › theo năm). */
export function availableYears(bills, currentYear) {
  const years = new Set([currentYear]);
  (bills || []).forEach((bill) => {
    if (typeof bill.date !== "string") return;
    const year = Number(bill.date.slice(0, 4));
    if (!Number.isNaN(year)) years.add(year);
  });
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Tổng của một kỳ cho sheet Thống kê. period: { mode: "month", month: "YYYY-MM" } hoặc
 * { mode: "year", year }.
 * - billCount: số bill chính; cầu: mọi bill kể cả bill con, gộp theo loại, xếp theo tên.
 * - players: chỉ bill chính, tiền (gồm nợ cũ) làm tròn nghìn từng bill, nhiều tiền trước,
 *   bỏ người 0 đồng.
 */
export function periodSummary(bills, period) {
  const prefix =
    period.mode === "year" ? String(period.year) : String(period.month);
  const inPeriod = (bills || []).filter(
    (bill) => typeof bill.date === "string" && bill.date.startsWith(prefix),
  );

  const shuttleMap = new Map();
  const playerMap = new Map();
  let billCount = 0;

  inPeriod.forEach((bill) => {
    (bill.bill_shuttles || []).forEach((shuttle) => {
      const id = shuttle.shuttle_type_id;
      if (!shuttleMap.has(id)) {
        shuttleMap.set(id, {
          name: shuttle.shuttle_type?.name || "Unknown",
          totalQuantity: 0,
        });
      }
      shuttleMap.get(id).totalQuantity += shuttle.quantity || 0;
    });

    if (bill.parent_bill_id) return;
    billCount += 1;
    (bill.bill_players || []).forEach((player) => {
      if (!playerMap.has(player.user_id)) {
        playerMap.set(player.user_id, {
          name: player.user?.name || "Unknown",
          totalAmount: 0,
          billCount: 0,
        });
      }
      const current = playerMap.get(player.user_id);
      current.totalAmount += roundToNearestThousand(
        (player.total_amount || 0) + (player.debt_amount || 0),
      );
      current.billCount += 1;
    });
  });

  const shuttles = Array.from(shuttleMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    billCount,
    shuttles,
    totalShuttles: shuttles.reduce((sum, s) => sum + s.totalQuantity, 0),
    players: Array.from(playerMap.values())
      .filter((p) => p.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount),
  };
}
