/**
 * Trạng thái rỗng căn giữa trong thẻ.
 * icon: component biểu tượng từ ./icons (vd Inbox); action: nút / link tuỳ chọn.
 */
export default function EmptyState({ icon: IconComponent, title, description, action }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-card">
      {IconComponent && (
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <IconComponent className="h-6 w-6" />
        </div>
      )}
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
