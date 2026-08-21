/**
 * Nút gợi ý nhân nghìn cho ô nhập tiền.
 *
 * Người dùng hay gõ tắt "500" khi ý là 500.000. Thay vì tự nhân — vừa gõ vừa
 * nhảy số thì rối, mà lại chặn mất trường hợp nhập số tiền lẻ thật — ta hiện
 * một nút để họ tự chọn.
 *
 * Chỉ hiện khi số đang nhập lớn hơn 0 và nhỏ hơn 1000. Ngoài khoảng đó thì
 * hoặc chưa nhập gì, hoặc đã là số tiền hoàn chỉnh.
 */
export default function ThousandHint({ value, onApply, exclude = [] }) {
  const raw = Number(value) || 0;
  const suggestion = raw * 1000;

  if (raw <= 0 || raw >= 1000 || exclude.includes(suggestion)) return null;

  return (
    <button
      type="button"
      onClick={() => onApply(suggestion)}
      className="mt-1.5 rounded-lg border border-dashed border-emerald-400 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition hover:border-emerald-500"
    >
      → {suggestion.toLocaleString("vi-VN")}đ
    </button>
  );
}
