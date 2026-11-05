/**
 * Phần đáy khung bố cục đang bị bàn phím ảo che (px). Trên iPhone và Chrome Android
 * (resizes-visual), bàn phím phủ lên trang: khung bố cục giữ nguyên, chỉ
 * window.visualViewport co lại — nên mọi thứ `fixed bottom-0` nằm dưới bàn phím.
 *
 * metrics = { innerHeight, height, offsetTop } (height / offsetTop của visualViewport).
 */
export function keyboardInset(metrics) {
  if (!metrics) return 0;
  const { innerHeight, height, offsetTop = 0 } = metrics;
  if (!Number.isFinite(innerHeight) || !Number.isFinite(height)) return 0;
  return Math.max(0, Math.round(innerHeight - height - offsetTop));
}

/** Che quá ngưỡng này mới coi là bàn phím (thanh địa chỉ co giãn chỉ vài chục px). */
export const KEYBOARD_OPEN_MIN = 120;
