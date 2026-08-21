import { useState, useEffect } from "react";

/** Style mặc định. Màn nào dùng bộ class khác thì truyền baseClassName để thay hẳn,
 *  đừng dồn vào className: hai bộ viền/bo góc chọi nhau thì Tailwind quyết theo thứ tự
 *  trong stylesheet chứ không theo thứ tự viết, kết quả không đoán trước được. */
const DEFAULT_BASE_CLASS =
  "px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function CurrencyInput({
  value,
  onChange,
  placeholder = "0",
  className = "",
  baseClassName = DEFAULT_BASE_CLASS,
}) {
  const [displayValue, setDisplayValue] = useState("");

  useEffect(() => {
    if (value !== undefined && value !== null) {
      setDisplayValue(formatNumber(value));
    }
  }, [value]);

  const formatNumber = (num) => {
    if (num === null || num === undefined) return "";
    const absNum = Math.abs(num);
    const formatted = new Intl.NumberFormat("vi-VN").format(absNum);
    return num < 0 ? "-" + formatted : formatted;
  };

  const handleChange = (e) => {
    let input = e.target.value.replace(/[^\d-]/g, "");

    // Only allow minus sign at the beginning
    if (input.includes("-")) {
      if (!input.startsWith("-")) {
        // Remove minus if it's not at the start
        input = input.replace(/-/g, "");
      } else if ((input.match(/-/g) || []).length > 1) {
        // Keep only the first minus sign
        input = "-" + input.replace(/-/g, "");
      }
    }

    // Parse the number
    let numValue = 0;
    if (input === "" || input === "-") {
      setDisplayValue(input);
      onChange?.(input === "-" ? 0 : 0);
      return;
    }

    if (input.startsWith("-")) {
      const numStr = input.substring(1);
      if (numStr) {
        numValue = -parseInt(numStr) || 0;
      }
    } else {
      numValue = parseInt(input) || 0;
    }

    setDisplayValue(formatNumber(numValue));
    onChange?.(numValue);
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={`${baseClassName} ${className}`}
    />
  );
}
