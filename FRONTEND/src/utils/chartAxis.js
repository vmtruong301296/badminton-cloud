/**
 * Đỉnh trục biểu đồ cột: số tròn nhỏ nhất ≥ giá trị lớn nhất, chọn từ 1 / 1,5 / 2 / 3 / 4 / 5 /
 * 6 / 8 × 10^n để cột cao nhất chiếm hơn nửa khung, và chia đôi ra số nguyên (vạch giữa không
 * bao giờ là 0,5). Không có số liệu thì 2.
 */
const STEPS = [1, 1.5, 2, 3, 4, 5, 6, 8, 10];
const MIN_AXIS = 2;

export function niceAxisMax(maxValue) {
  if (!(maxValue > MIN_AXIS)) return MIN_AXIS;
  const power = 10 ** Math.floor(Math.log10(maxValue));
  const axis = STEPS.map((step) => Math.round(step * power)).find(
    (candidate) => candidate >= maxValue && candidate % 2 === 0,
  );
  return axis ?? 20 * power;
}
