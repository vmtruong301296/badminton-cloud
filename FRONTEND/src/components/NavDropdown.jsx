import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/**
 * Dropdown cho một nhóm menu trên thanh ngang desktop.
 *
 * Đóng khi: bấm ra ngoài, chọn một mục, hoặc nhấn Esc. Listener chỉ gắn khi
 * đang mở để không treo handler toàn cục lúc không cần.
 */
export default function NavDropdown({ group, isActive, isItemActive }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative flex items-center">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium h-16 ${
          isActive
            ? "border-blue-500 text-gray-900"
            : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
        }`}
      >
        <span className="mr-2">{group.icon}</span>
        {group.label}
        <svg
          className={`ml-1 h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full w-56 rounded-lg bg-white shadow-lg border border-slate-200 py-1 z-50">
          {group.children.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setOpen(false)}
              className={`flex items-center px-4 py-2 text-sm ${
                isItemActive(item.path)
                  ? "bg-blue-50 text-blue-700 font-medium"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              <span className="mr-2">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
