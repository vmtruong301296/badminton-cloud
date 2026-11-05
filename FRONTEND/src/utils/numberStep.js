const decimalsOf = (n) => {
  const text = String(n);
  const dot = text.indexOf(".");
  return dot === -1 ? 0 : text.length - dot - 1;
};

const clamp = (value, { min, max }) => {
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;
  return value;
};

const toNumber = (value, min) => {
  const n = typeof value === "number" ? value : parseFloat(value);
  if (Number.isFinite(n)) return n;
  return min !== undefined ? min : 0;
};

/**
 * Giá trị sau khi bấm −/+ (M17): direction -1 hoặc 1, nhảy `step`, kẹp trong [min, max].
 * Ô trống coi như min (hoặc 0). Làm tròn theo số chữ số thập phân của step / giá trị.
 */
export function stepNumber(value, direction, { step = 1, min, max } = {}) {
  const current = toNumber(value, min);
  const digits = Math.max(decimalsOf(step), decimalsOf(current));
  const next = Number((current + direction * step).toFixed(digits));
  return clamp(next, { min, max });
}

/** Còn bấm được theo hướng này không (để tắt nút ở min / max). */
export function canStep(value, direction, { min, max } = {}) {
  const current = toNumber(value, min);
  if (direction < 0) return min === undefined || current > min;
  return max === undefined || current < max;
}
