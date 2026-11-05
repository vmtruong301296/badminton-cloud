import { ChevronUp } from "./icons";

function Summary({ label, value, onClick, ariaLabel }) {
  const content = (
    <>
      <span className="action-bar-sum-label">{label}</span>
      <span className="action-bar-sum-value">
        {value}
        {onClick && <ChevronUp className="h-4 w-4 text-slate-400" />}
      </span>
    </>
  );

  if (!onClick) return <div className="action-bar-sum">{content}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup="dialog"
      className="action-bar-sum"
    >
      {content}
    </button>
  );
}

/**
 * Thanh hành động dính đáy trên điện thoại (M2); desktop ẩn (sm:hidden) nên màn
 * vẫn phải có nút cho desktop ở chỗ cũ.
 *
 * - children: tối đa 1 nút chính + 1 nút phụ, màn tự dựng (vd
 *   <button className="btn btn-primary flex-1">). Đang xử lý: nút hiện spinner + chữ đang có,
 *   tắt cả hai nút.
 * - summary: { label, value, onClick?, ariaLabel? } → dòng tổng bên trái (value đã in qua
 *   formatters.js). Có onClick thì cả vùng là nút mở sheet tóm tắt (kèm ^), ariaLabel bắt buộc.
 * - overTab: màn gốc còn thanh tab (Thuê xe) → thanh đứng ngay trên tab.
 *
 * Màn có ActionBar thì nội dung tự chừa đáy (.app-main:has(.action-bar)), thông báo M8
 * tự nằm trên thanh — không cần pb-24.
 */
export default function ActionBar({
  children,
  summary,
  overTab = false,
  className = "",
}) {
  return (
    <div
      className={`action-bar ${overTab ? "action-bar-over-tab" : ""} ${className}`}
    >
      {summary && <Summary {...summary} />}
      {children}
    </div>
  );
}
