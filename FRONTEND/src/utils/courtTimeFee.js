import { roundUpToThousand } from "./formatters";

/**
 * Tính tiền sân theo giờ cho bill con (đánh thêm sau giờ chính): mỗi sân một khoảng giờ, đơn
 * giá một sân / 2 giờ lấy từ Master → Giá sân theo ngày bill, tính theo phút. Tổng làm tròn LÊN
 * nghìn một lần trên tổng, không làm tròn từng sân. Khung giờ lưu kèm bill (court_slots) để mở
 * lại sửa; tiền sân vẫn là court_total người dùng chốt (gõ tay được).
 */

export const COURT_BLOCK_MINUTES = 120;
export const DEFAULT_COURT_START = "21:00";
export const COURT_TIME_ERROR = "Giờ kết thúc phải sau giờ bắt đầu";

const TIME_PATTERN = /^(\d{2}):(\d{2})/;

/** "HH:MM" hoặc "HH:MM:SS" (giá trị ô giờ của trình duyệt) → số phút trong ngày; sai / trống → null. */
const toMinutes = (value) => {
  const match = TIME_PATTERN.exec(value ?? "");
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

/** Nhân trước chia sau để số phút tròn block (vd 120 phút) ra đúng số nguyên. */
const feeOf = (minutes, pricePerBlock) =>
  (minutes * pricePerBlock) / COURT_BLOCK_MINUTES;

/** Số phút của một sân: chưa đủ giờ → { minutes: null }, kết thúc không sau bắt đầu → lỗi. */
function courtMinutes({ start, end }) {
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from === null || to === null) return { minutes: null, error: null };
  if (to <= from) return { minutes: null, error: COURT_TIME_ERROR };
  return { minutes: to - from, error: null };
}

/**
 * @param {{ start: string, end: string }[]} courts
 * @param {number} pricePerBlock giá một sân / 2 giờ (courtPriceForDate)
 * @returns {{
 *   lines: { minutes: number | null, amount: number, error: string | null }[],
 *   exactTotal: number,
 *   total: number,
 *   hasValid: boolean,
 * }} `total`: đã làm tròn lên nghìn; `hasValid`: có ít nhất một sân tính được tiền.
 */
export function calculateCourtTimeFee(courts, pricePerBlock) {
  const lines = courts.map((court) => {
    const { minutes, error } = courtMinutes(court);
    return {
      minutes,
      amount: minutes === null ? 0 : feeOf(minutes, pricePerBlock),
      error,
    };
  });
  const totalMinutes = lines.reduce(
    (sum, line) => sum + (line.minutes ?? 0),
    0,
  );
  const exactTotal = feeOf(totalMinutes, pricePerBlock);
  return {
    lines,
    exactTotal,
    total: roundUpToThousand(exactTotal),
    hasValid: totalMinutes > 0,
  };
}

/**
 * Giá một sân / 2 giờ áp dụng cho ngày bill: mốc effective_from mới nhất không sau ngày đó.
 * Chưa có lịch giá (đang tải / lỗi) hoặc chưa có mốc nào trước ngày bill → null.
 *
 * @param {{ effective_from: string, price: number }[] | null | undefined} prices
 * @param {string} date "YYYY-MM-DD"
 * @returns {number | null}
 */
export function courtPriceForDate(prices, date) {
  const match = (prices ?? [])
    .filter((p) => p.effective_from <= date)
    .reduce(
      (best, p) => (!best || p.effective_from > best.effective_from ? p : best),
      null,
    );
  return match ? Number(match.price) : null;
}

/** Dòng sân mới trên form: bắt đầu 21:00, chưa có giờ kết thúc. */
export const newCourtRow = (key) => ({
  key,
  start: DEFAULT_COURT_START,
  end: "",
});

/**
 * Khung giờ đã lưu của bill (court_slots) → các dòng sân trên form (có key). Chưa lưu gì
 * (bill cũ, bill mới) → một dòng Sân 1 trống.
 *
 * @param {{ start: string, end: string }[] | null | undefined} slots
 */
export function courtRowsFromSlots(slots) {
  if (!slots?.length) return [newCourtRow(1)];
  return slots.map((slot, index) => ({
    key: index + 1,
    start: slot.start,
    end: slot.end,
  }));
}

const hhmm = (value) => TIME_PATTERN.exec(value)[0];

/**
 * Các dòng sân trên form → court_slots gửi lên API: chỉ dòng đủ giờ và hợp lệ, bỏ key, giờ
 * dạng HH:MM (máy chủ kiểm date_format:H:i).
 *
 * @param {{ start: string, end: string }[] | undefined} rows
 * @returns {{ start: string, end: string }[]}
 */
export function courtSlotsPayload(rows) {
  return (rows ?? [])
    .filter((row) => courtMinutes(row).minutes !== null)
    .map((row) => ({ start: hhmm(row.start), end: hhmm(row.end) }));
}
