import { createContext } from "react";

/**
 * Khe của thanh trên điện thoại do Layout cung cấp: { slot, register }.
 * - slot: nút DOM để AppBar đưa tiêu đề / nút quay lại / ⋯ vào (createPortal).
 * - register({ pushed, hideTabBar }): màn báo loại màn cho Layout; trả hàm hủy.
 * Ngoài Layout giá trị là null (PageHeader khi đó tự hiện tiêu đề như cũ).
 */
const AppBarContext = createContext(null);

export default AppBarContext;
