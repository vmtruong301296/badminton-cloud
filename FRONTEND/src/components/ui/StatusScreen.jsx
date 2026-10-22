const TONES = {
  slate: "bg-slate-100 text-slate-500",
  rose: "bg-rose-50 text-rose-600",
};

/**
 * Màn trạng thái toàn trang (đang tải, mất kết nối, không có quyền): một thẻ
 * giữa màn hình nền slate-50, biểu tượng, tiêu đề, mô tả và nút tuỳ chọn.
 */
export default function StatusScreen({ icon: IconComponent, tone = "slate", spin = false, title, description, action }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="card w-full max-w-sm text-center sm:p-8" role="status">
        {IconComponent && (
          <div
            className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${TONES[tone] || TONES.slate}`}
          >
            <IconComponent className={`h-6 w-6 ${spin ? "animate-spin" : ""}`} />
          </div>
        )}
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
