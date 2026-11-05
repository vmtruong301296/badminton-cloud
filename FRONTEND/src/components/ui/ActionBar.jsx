import { ChevronUp } from "./icons";

// Tông màu số tiền của dòng tổng (class trong index.css).
const TONES = {
  danger: "action-bar-sum-danger",
  success: "action-bar-sum-success",
};

function Summary({
  label,
  value,
  onClick,
  ariaLabel,
  haspopup = "dialog",
  icon,
  tone,
}) {
  // icon: mặc định ^ khi bấm được; truyền component khác, hoặc null để không có biểu tượng.
  const IconComponent = icon === undefined ? ChevronUp : icon;
  const className = `action-bar-sum ${TONES[tone] || ""}`;
  const content = (
    <>
      <span className="action-bar-sum-label">{label}</span>
      <span className="action-bar-sum-value">
        {value}
        {onClick && IconComponent && (
          <IconComponent className="h-4 w-4 text-slate-400" />
        )}
      </span>
    </>
  );

  if (!onClick) return <div className={className}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-haspopup={haspopup || undefined}
      className={className}
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
 * - summary: { label, value, onClick?, ariaLabel?, haspopup?, icon?, tone? } → dòng tổng bên trái
 *   (value đã in qua formatters.js). Có onClick thì cả vùng là nút (kèm ^):
 *   - mặc định mở sheet tóm tắt (aria-haspopup="dialog"), ariaLabel bắt buộc;
 *   - haspopup={false}: nút thường (vd chạm để cuộn tới khối Kết quả), không báo mở hộp thoại;
 *   - icon: component biểu tượng thay cho ^, hoặc null để không có.
 *   tone: "danger" (số rose, vd còn thiếu) | "success" (số emerald, vd đã thu đủ).
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
