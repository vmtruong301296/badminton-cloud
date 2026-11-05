import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Hỏi lại trước khi rời màn tạo / sửa bill khi đã nhập (ConfirmDialog do màn dựng).
 *
 * - onBackClick: truyền vào `back.onClick` của PageHeader — chặn nút ‹ trên thanh trên (M1) và
 *   link "‹ Danh sách" của desktop rồi mở hộp hỏi.
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

    const handleBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [when]);

  return {
    isOpen: pendingTo !== null,
    // Bấm ‹ / link quay lại: đã nhập thì ở lại và hỏi; Ctrl / Cmd + bấm (mở tab mới) để nguyên.
    onBackClick: (event) => {
      if (
        !when ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      event.preventDefault();
      setPendingTo(backTo);
    },
    requestLeave: (to = backTo) => (when ? setPendingTo(to) : navigate(to)),
    cancel: () => setPendingTo(null),
    confirm: () => {
      const to = pendingTo;
      setPendingTo(null);
      navigate(to);
    },
  };
}
