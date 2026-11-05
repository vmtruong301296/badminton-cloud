import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "./icons";
import useKeyboardInset from "./useKeyboardInset";

const SIZES = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-2xl",
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Nhiều hộp thoại có thể mở chồng nhau: chỉ mở khóa cuộn khi hộp cuối cùng đóng.
let openCount = 0;
let savedOverflow = "";

/**
 * Hộp thoại dùng chung. Điện thoại: bottom sheet sát đáy; desktop: hộp giữa màn.
 * Bấm nền hoặc Esc thì đóng; focus vào ô nhập đầu tiên khi mở; khóa cuộn trang.
 * Điện thoại: cao tối đa 90dvh; khi bàn phím ảo bật, cả sheet nâng lên ngay trên bàn phím
 * (đọc window.visualViewport) để ô đang nhập và chân sheet luôn thấy.
 *
 * Props: isOpen, onClose, title, children, footer (vùng nút dưới đáy), size (sm|md|lg|xl),
 * initialFocus ("field": focus ô nhập đầu tiên như cũ | "panel": focus khung, không bật bàn
 * phím — sheet chọn / lọc / menu / tóm tắt), dismissible (false: bấm nền, Esc, nút đóng
 * không đóng — vd đang xử lý), height ("auto" | "tall": cao cố định ~85dvh, cho sheet chọn
 * nhiều để danh sách không nhảy chiều cao khi lọc).
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = "md",
  initialFocus = "field",
  dismissible = true,
  height = "auto",
}) {
  const panelRef = useRef(null);
  const bodyRef = useRef(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  const initialFocusRef = useRef(initialFocus);
  const titleId = useId();
  const { inset: keyboard, viewportHeight } = useKeyboardInset(isOpen);

  useEffect(() => {
    onCloseRef.current = onClose;
    dismissibleRef.current = dismissible;
    initialFocusRef.current = initialFocus;
  }, [onClose, dismissible, initialFocus]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previouslyFocused = document.activeElement;

    if (openCount === 0) savedOverflow = document.body.style.overflow;
    openCount += 1;
    document.body.style.overflow = "hidden";

    // Focus vào ô nhập đầu tiên của phần nội dung; không có (hoặc initialFocus="panel") thì vào chính hộp.
    const firstField =
      initialFocusRef.current === "field"
        ? bodyRef.current?.querySelector(
            "input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled])",
          )
        : null;
    (firstField || panelRef.current)?.focus({ preventScroll: true });

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (dismissibleRef.current) onCloseRef.current?.();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      // Giữ Tab quay vòng trong hộp thoại.
      const items = Array.from(panelRef.current.querySelectorAll(FOCUSABLE));
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      openCount -= 1;
      if (openCount === 0) document.body.style.overflow = savedOverflow;
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // Bàn phím đang che: CSS (index.css, chỉ điện thoại) nâng sheet lên bằng phần bị che.
  const keyboardStyle =
    keyboard > 0
      ? { "--kb-inset": `${keyboard}px`, "--vv-h": `${viewportHeight}px` }
      : undefined;

  return createPortal(
    <div
      className="modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        style={keyboardStyle}
        onFocus={(event) => {
          // Ô trong thân sheet vừa được focus: đợi bàn phím mở xong rồi cuộn ô vào chỗ thấy.
          const target = event.target;
          if (!target.matches?.("input, select, textarea")) return;
          window.setTimeout(() => {
            if (document.activeElement === target)
              target.scrollIntoView({ block: "nearest" });
          }, 300);
        }}
        className={`modal-panel flex w-full flex-col rounded-t-2xl bg-white shadow-lg focus:outline-none sm:max-h-[85vh] sm:rounded-2xl ${height === "tall" ? "modal-panel-tall sm:h-[min(80vh,720px)]" : ""} ${SIZES[size] || SIZES.md}`}
      >
        {title && (
          <div className="flex items-start justify-between gap-3 px-5 pb-2 pt-5">
            <h2
              id={titleId}
              className="min-w-0 break-words text-lg font-semibold tracking-tight text-slate-900"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              disabled={!dismissible}
              aria-label="Đóng"
              className="-mr-2 -mt-1 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}
        <div
          ref={bodyRef}
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${
            title ? "py-2" : "pt-5"
          } ${footer ? "pb-4" : "pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:pb-5"}`}
        >
          {children}
        </div>
        {footer && (
          <div className="border-t border-slate-100 px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:pb-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
