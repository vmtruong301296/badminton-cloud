import { useEffect } from "react";

/**
 * Đóng menu thả khi bấm ra ngoài vùng `ref` hoặc nhấn Esc. Listener chỉ gắn
 * khi đang mở để không treo handler toàn cục lúc không cần.
 */
export default function useDismiss(open, ref, onDismiss) {
  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (ref.current && !ref.current.contains(event.target)) onDismiss();
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, ref, onDismiss]);
}
