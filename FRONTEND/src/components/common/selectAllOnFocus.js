/**
 * Bôi đen cả số khi chạm vào ô (CurrencyInput / NumberInput prop selectOnFocus). Đợi một
 * khung hình vì iOS đặt con trỏ sau sự kiện focus.
 */
export default function selectAllOnFocus(event) {
  const input = event.currentTarget;
  window.requestAnimationFrame(() => {
    if (document.activeElement === input) input.select();
  });
}
