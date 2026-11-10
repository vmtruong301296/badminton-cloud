import { roundUpToThousand } from "./formatters";

/**
 * Tính tiền sân theo giờ cho bill con (đánh thêm sau giờ chính): mỗi sân một khoảng giờ,
 * đơn giá 140.000đ / 2 giờ / sân, tính theo phút. Tổng làm tròn LÊN nghìn một lần trên tổng,
 * không làm tròn từng sân. Chỉ là công cụ gợi ý số tiền sân, không lưu vào bill.
 */

export const COURT_PRICE_PER_BLOCK = 140000;
export const COURT_BLOCK_MINUTES = 120;
export const DEFAULT_COURT_START = "21:00";
export const COURT_TIME_ERROR = "Giờ kết thúc phải sau giờ bắt đầu";

/** "HH:MM" hoặc "HH:MM:SS" (giá trị ô giờ của trình duyệt) → số phút trong ngày; sai / trống → null. */
const toMinutes = (value) => {
  const match = /^(\d{2}):(\d{2})/.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** Nhân trước chia sau để số phút tròn block (vd 120 phút) ra đúng số nguyên. */
const feeOf = (minutes) =>
  (minutes * COURT_PRICE_PER_BLOCK) / COURT_BLOCK_MINUTES;

/** Một sân: chưa đủ giờ thì bỏ qua (không lỗi); giờ kết thúc không sau giờ bắt đầu thì báo lỗi. */
function courtLine({ start, end }) {
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from === null || to === null) {
    return { minutes: null, amount: 0, error: null };
  }
  if (to <= from) {
    return { minutes: null, amount: 0, error: COURT_TIME_ERROR };
  }
  const minutes = to - from;
  return { minutes, amount: feeOf(minutes), error: null };
}

/**
 * @param {{ start: string, end: string }[]} courts
 * @returns {{
 *   lines: { minutes: number | null, amount: number, error: string | null }[],
 *   exactTotal: number,
 *   total: number,
 *   hasValid: boolean,
 * }} `total`: đã làm tròn lên nghìn; `hasValid`: có ít nhất một sân tính được tiền.
 */
export function calculateCourtTimeFee(courts) {
  const lines = courts.map(courtLine);
  const totalMinutes = lines.reduce(
    (sum, line) => sum + (line.minutes ?? 0),
    0,
  );
  const exactTotal = feeOf(totalMinutes);
  return {
    lines,
    exactTotal,
    total: roundUpToThousand(exactTotal),
    hasValid: totalMinutes > 0,
  };
}
