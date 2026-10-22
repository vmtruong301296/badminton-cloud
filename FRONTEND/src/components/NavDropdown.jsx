import { useCallback, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "./ui/icons";
import useDismiss from "./ui/useDismiss";

/**
 * Dropdown cho một nhóm menu trên thanh ngang desktop.
 *
 * Đóng khi: bấm ra ngoài, chọn một mục, hoặc nhấn Esc.
 * items: [{ key, path, label, icon: Component }]
 */
export default function NavDropdown({
  label,
  icon: IconComponent,
  items,
  isActive,
  isItemActive,
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const close = useCallback(() => setOpen(false), []);

  useDismiss(open, containerRef, close);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
          isActive
            ? "bg-slate-100 text-slate-900"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`}
      >
        {IconComponent && (
          <IconComponent
            className={`hidden h-4 w-4 xl:block ${isActive ? "text-emerald-700" : ""}`}
          />
        )}
        {label}
        <ChevronDown
          className={`h-4 w-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
          {items.map((item) => {
            const ItemIcon = item.icon;
            const active = isItemActive(item);
            return (
              <Link
                key={item.key ?? item.path}
                to={item.path}
                onClick={close}
                aria-current={active ? "page" : undefined}
                className={`flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
                  active
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {ItemIcon && (
                  <ItemIcon
                    className={`h-4 w-4 ${active ? "text-emerald-700" : ""}`}
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
