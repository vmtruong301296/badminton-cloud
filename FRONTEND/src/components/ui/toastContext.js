import { createContext } from "react";

/** API thông báo ngắn (M8) do ToastProvider cung cấp; dùng qua useToast(). */
const ToastContext = createContext(null);

export default ToastContext;
