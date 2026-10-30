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
