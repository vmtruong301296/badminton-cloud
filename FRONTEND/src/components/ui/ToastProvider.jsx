import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ToastContext from "./toastContext";
import { CircleAlert, CircleCheck, X } from "./icons";

// Thời gian tự tắt (ms): lỗi lâu hơn để kịp đọc và luôn có nút đóng (WCAG 2.2.1).
const DURATION = { success: 4000, info: 5000, error: 7000 };

function ToastItem({ toast, onDismiss }) {
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(DURATION[toast.type] ?? DURATION.info);

  // Đếm lùi; dừng khi đang chạm giữ, focus hoặc rê chuột vào thông báo.
  useEffect(() => {
    if (paused) return undefined;
    const startedAt = Date.now();
    const timer = setTimeout(onDismiss, Math.max(remainingRef.current, 0));
    return () => {
      clearTimeout(timer);
      remainingRef.current -= Date.now() - startedAt;
    };
  }, [paused, onDismiss]);

  const pause = () => setPaused(true);
  const resume = () => setPaused(false);
  const isError = toast.type === "error";

  return (
    <div
      className="toast"
      onPointerEnter={pause}
      onPointerLeave={resume}
      onTouchStart={pause}
      onTouchEnd={resume}
      onFocus={pause}
      onBlur={resume}
    >
      {toast.type === "success" && (
        <CircleCheck className="h-5 w-5 flex-none text-emerald-400" />
      )}
      {isError && <CircleAlert className="h-5 w-5 flex-none text-rose-400" />}
      <span className="toast-text">{toast.message}</span>
      {toast.onRetry && (
        <button
          type="button"
          onClick={() => {
            onDismiss();
            toast.onRetry();
          }}
          className="toast-action"
        >
          Thử lại
        </button>
      )}
      {isError && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Đóng"
          className="toast-close"
        >
          <X className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/**
 * Bọc app một lần (App.jsx). Hai vùng thông báo luôn có trong DOM: role="status"
 * (thành công / thông tin) và role="alert" (lỗi); không lấy focus khi hiện.
 * Vị trí dính đáy tự tính bằng CSS theo tab / FAB / ActionBar (index.css).
 */
export default function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const nextId = useRef(0);

  const dismiss = useCallback(() => setToast(null), []);

  const show = useCallback((message, { type = "info", onRetry } = {}) => {
    nextId.current += 1;
    setToast({ id: nextId.current, type, message, onRetry });
  }, []);

  const api = useMemo(
    () => ({
      show,
      dismiss,
      success: (message, options) =>
        show(message, { ...options, type: "success" }),
      error: (message, options) => show(message, { ...options, type: "error" }),
      info: (message, options) => show(message, { ...options, type: "info" }),
    }),
    [show, dismiss],
  );

  const item = toast && (
    <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toast?.type !== "error" && item}
      </div>
      <div className="toast-region" role="alert" aria-live="assertive">
        {toast?.type === "error" && item}
      </div>
    </ToastContext.Provider>
  );
}
