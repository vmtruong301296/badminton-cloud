/** Tồn kho cầu: đơn vị và ngưỡng cảnh báo (màn Loại cầu). */
export const BALLS_PER_TUBE = 12;
// Ngưỡng sắp hết: dưới 10 ống (dùng cho cảnh báo tổng và tô màu từng loại)
export const LOW_STOCK_TUBES = 10;
export const LOW_STOCK_BALLS = LOW_STOCK_TUBES * BALLS_PER_TUBE;

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
