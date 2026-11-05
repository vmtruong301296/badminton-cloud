import { CircleAlert, RotateCcw } from "./icons";

const TONES = {
  slate: "bg-slate-100 text-slate-500",
  error: "bg-rose-50 text-rose-600",
};

/**
 * Trạng thái rỗng căn giữa trong thẻ (M13).
 * icon: component biểu tượng từ ./icons (vd Inbox); action: nút / link tuỳ chọn.
 * tone="error": lỗi tải (vòng rose, mặc định biểu tượng CircleAlert, role="alert");
 *   title = câu lỗi cũ, onRetry → nút "Thử lại" gọi lại hàm tải.
 * compact: đệm 24 thay 48 (rỗng sau lọc, khối nhỏ trong trang / sheet).
 */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  tone = "slate",
  compact = false,
  onRetry,
}) {
  const isError = tone === "error";
  const IconComponent = icon || (isError ? CircleAlert : null);

  return (
    <div
      role={isError ? "alert" : undefined}
      className={`rounded-2xl border border-slate-200 bg-white text-center shadow-card ${compact ? "px-4 py-6" : "px-6 py-12"}`}
    >
      {IconComponent && (
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full ${compact ? "mb-3" : "mb-4"} ${TONES[tone] || TONES.slate}`}
        >
          <IconComponent className="h-6 w-6" />
        </div>
      )}
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {(action || onRetry) && (
        <div className={`flex justify-center gap-2 ${compact ? "mt-4" : "mt-5"}`}>
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn btn-secondary">
              <RotateCcw className="h-4 w-4" />
              Thử lại
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
