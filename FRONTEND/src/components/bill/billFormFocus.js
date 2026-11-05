/**
 * Điều khiển con trỏ trong form tạo / sửa bill (dùng chung CreateBill, EditBill).
 */

// Ô đang hiện trên màn (ô của bố cục kia bị ẩn bằng display: none).
const isShown = (el) => el.getClientRects().length > 0;

/**
 * onKeyDown của <form>: Enter trong ô nhập không gửi bill. Ô có data-next="<nhóm>" thì Enter
 * nhảy sang ô kế cùng nhóm (tiền sân → số quả cầu 1 → cầu 2; nội dung cộng thêm → số tiền),
 * ô cuối nhóm thì đóng bàn phím.
 */
export function focusNextOnEnter(event) {
  if (event.key !== "Enter" || event.nativeEvent?.isComposing) return;
  const field = event.target;
  if (field?.tagName !== "INPUT") return;
  event.preventDefault();

  const group = field.dataset.next;
  if (!group) return;
  const fields = Array.from(
    event.currentTarget.querySelectorAll(`[data-next="${group}"]`),
  ).filter(isShown);
  const next = fields[fields.indexOf(field) + 1];
  if (next) next.focus();
  else field.blur();
}

/** Cuộn tới ô có data-field (lỗi đầu tiên, M14) và đặt con trỏ vào đó. */
export function focusField(fieldKey) {
  const target = Array.from(
    document.querySelectorAll(`[data-field="${fieldKey}"]`),
  ).find(isShown);
  if (!target) return;
  target.scrollIntoView({ block: "center" });
  target.focus({ preventScroll: true });
}
