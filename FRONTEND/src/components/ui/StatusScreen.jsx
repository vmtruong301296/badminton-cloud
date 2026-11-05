const TONES = {
  slate: "bg-slate-100 text-slate-500",
  rose: "bg-rose-50 text-rose-600",
};

/**
 * Màn trạng thái toàn trang (đang tải, mất kết nối, không có quyền): nền slate-50, biểu
 * tượng, tiêu đề, mô tả và nút tuỳ chọn. Điện thoại: không thẻ, căn giữa; desktop: thẻ giữa màn.
 * brand: biểu tượng app + "Sổ cầu lông" ở trên (màn đang tải khi mở app), tiêu đề thành dòng
 * nhỏ kèm vòng quay (spin).
 */
export default function StatusScreen({ icon: IconComponent, tone = "slate", spin = false, brand = false, title, description, action }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div
        className="w-full max-w-sm text-center sm:rounded-2xl sm:border sm:border-slate-200 sm:bg-white sm:p-8 sm:shadow-card"
        role="status"
      >
        {brand ? (
          <>
            <img src="/favicon.svg" alt="" className="mx-auto h-16 w-16" />
            <div className="mt-4 text-lg font-semibold tracking-tight text-slate-900">Sổ cầu lông</div>
            <h1 className="mt-3 flex items-center justify-center gap-2 text-sm font-medium text-slate-500">
              {IconComponent && <IconComponent className={`h-4 w-4 ${spin ? "animate-spin" : ""}`} />}
              {title}
            </h1>
          </>
        ) : (
          <>
            {IconComponent && (
              <div
                className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full sm:h-12 sm:w-12 ${TONES[tone] || TONES.slate}`}
              >
                <IconComponent className={`h-7 w-7 sm:h-6 sm:w-6 ${spin ? "animate-spin" : ""}`} />
              </div>
            )}
            <h1 className="text-lg font-semibold tracking-tight text-slate-900">{title}</h1>
          </>
        )}
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
      </div>
    </div>
  );
}
