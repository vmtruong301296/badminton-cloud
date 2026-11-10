import { useEffect, useState } from "react";
import { courtPricesApi } from "../../services/api";

const LOAD_ERROR = "Không tải được giá sân. Tải lại trang để thử lại.";

/**
 * Lịch giá sân (GET /court-prices) cho bảng "Tính theo giờ" của bill con; tải một lần khi mở
 * form. Màn chọn giá theo ngày bill bằng courtPriceForDate.
 *
 * @returns {{ prices: { effective_from: string, price: number }[] | null, error: string | null }}
 *   `prices` null khi đang tải hoặc tải lỗi.
 */
export default function useCourtPrices() {
  const [state, setState] = useState({ prices: null, error: null });

  useEffect(() => {
    let cancelled = false;
    courtPricesApi
      .getAll()
      .then((res) => {
        if (!cancelled) setState({ prices: res.data || [], error: null });
      })
      .catch((error) => {
        console.error("Error loading court prices:", error);
        if (!cancelled) setState({ prices: null, error: LOAD_ERROR });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
