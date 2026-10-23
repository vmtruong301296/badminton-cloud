import { Link } from "react-router-dom";
import { ChevronLeft } from "./icons";

/**
 * Đầu màn: tiêu đề h1, mô tả, nút hành động.
 * - description: chuỗi hoặc node (vd badge, ngày); khung bọc là div nên đặt được cả khối.
 * - actions: nằm bên phải trên desktop, xuống dưới tiêu đề trên điện thoại.
 * - back: { to, label } -> liên kết quay lại có mũi tên, đặt trên tiêu đề.
 */
export default function PageHeader({ title, description, actions, back, compactActions = false }) {
  return (
    <div className="mb-3 sm:mb-6">
      {back && (
        <Link
          to={back.to}
          className="-ml-2 mb-2 inline-flex h-11 items-center gap-1 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 sm:h-9"
        >
          <ChevronLeft className="h-4 w-4" />
          {back.label}
        </Link>
      )}
      <div className={`flex gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 ${compactActions ? "flex-row items-center justify-between" : "flex-col"}`}>
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
            {title}
          </h1>
          {description && (
            <div className="mt-0.5 text-xs text-slate-500 sm:mt-1 sm:text-sm">{description}</div>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
