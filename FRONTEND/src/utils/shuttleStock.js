/**
 * Tồn kho cầu (12 quả / ống): in số cầu ở màn "Bill cầu" / Thống kê và mức cảnh báo
 * từng loại ở màn Loại cầu.
 */
import { formatNumber } from "./formatters";

export const BALLS_PER_TUBE = 12;
/** Ngưỡng sắp hết: dưới 10 ống (cảnh báo tổng ở "Bill cầu" và tô màu từng loại ở Loại cầu). */
export const LOW_STOCK_TUBES = 10;
export const LOW_STOCK_BALLS = LOW_STOCK_TUBES * BALLS_PER_TUBE;

const split = (totalBalls) => {
  const n = Math.floor(Number(totalBalls) || 0);
  return { n, tubes: Math.floor(n / BALLS_PER_TUBE), rest: n % BALLS_PER_TUBE };
};

/** Tồn kho: quả + gợi ý ống, vd "15 ống + 6 quả (186 quả)". */
export function formatShuttleStock(totalBalls) {
  const { n, tubes, rest } = split(totalBalls);
  if (n <= 0 || tubes === 0) return `${formatNumber(n)} quả`;
  if (rest === 0) return `${tubes} ống (${formatNumber(n)} quả)`;
  return `${tubes} ống + ${rest} quả (${formatNumber(n)} quả)`;
}

/** Ống + quả lẻ, vd "3 ống + 2 quả" (dòng phụ ô Số cầu ở Thống kê). */
export function formatTubes(totalBalls) {
  const { n, tubes, rest } = split(totalBalls);
  if (n <= 0 || tubes === 0) return `${formatNumber(n)} quả`;
  return rest === 0 ? `${tubes} ống` : `${tubes} ống + ${rest} quả`;
}

/** Ô tóm tắt "Cầu khả dụng": số chính là ống, dòng phụ là quả lẻ + tổng quả. */
export function stockTileParts(totalBalls) {
  const { n, tubes, rest } = split(totalBalls);
  if (n <= 0 || tubes === 0)
    return { value: `${formatNumber(n)} quả`, sub: "" };
  return {
    value: `${tubes} ống`,
    sub:
      rest === 0
        ? `${formatNumber(n)} quả`
        : `+ ${rest} quả (${formatNumber(n)} quả)`,
  };
}

/**
 * Mức tồn kho của một loại cầu:
 * "out" khi ≤ 0 (bill trừ kho không chặn nên có thể âm), "low" khi dưới 10 ống, "ok" còn lại.
 */
export function stockLevel(quantity) {
  const balls = Number(quantity) || 0;
  if (balls <= 0) return "out";
  if (balls < LOW_STOCK_BALLS) return "low";
  return "ok";
}
