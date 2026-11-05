import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Hỏi lại trước khi rời màn tạo / sửa bill khi đã nhập (ConfirmDialog do màn dựng).
 *
 * - Chặn bấm vào link dẫn tới `backTo`: nút ‹ trên thanh trên (M1), link "‹ Danh sách" của
 *   desktop. Nút ‹ nằm trong AppBar của nhóm khung app (chưa có onClick) nên bắt ở pha capture
 *   của document, trước khi react-router xử lý.
 * - Tải lại / đóng tab: hộp hỏi của trình duyệt (beforeunload).
 * - requestLeave(to): cho nút "Hủy" của desktop.
 *
 * App dùng BrowserRouter (không có useBlocker) nên nút Back của trình duyệt chưa chặn được.
 */
export default function useConfirmLeave({ when, backTo }) {
  const navigate = useNavigate();
  const [pendingTo, setPendingTo] = useState(null);

  useEffect(() => {
    if (!when) return undefined;

    const handleClick = (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event.target.closest?.("a[href]");
      if (!link || link.getAttribute("href") !== backTo) return;
      event.preventDefault();
      event.stopPropagation();
      setPendingTo(backTo);
    };
    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    document.addEventListener("click", handleClick, true);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [when, backTo]);

  return {
    isOpen: pendingTo !== null,
    requestLeave: (to = backTo) => (when ? setPendingTo(to) : navigate(to)),
    cancel: () => setPendingTo(null),
    confirm: () => {
      const to = pendingTo;
      setPendingTo(null);
      navigate(to);
    },
  };
}
