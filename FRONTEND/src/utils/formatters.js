import { playerExtraTotal } from "./menus";

/**
 * Format number as Vietnamese currency (VND)
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

/**
 * Format number with thousand separators
 */
export const formatNumber = (num) => {
  return new Intl.NumberFormat('vi-VN').format(num);
};

export const roundToNearestThousand = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.round(num / 1000) * 1000;
};

/** Làm tròn LÊN nghìn: 29.167 → 30.000, 30.000 giữ nguyên. */
export const roundUpToThousand = (value) => {
  const num = Number(value);
  if (Number.isNaN(num)) return 0;
  return Math.ceil(num / 1000) * 1000;
};

export const formatCurrencyRounded = (value) => {
  return formatCurrency(roundToNearestThousand(value));
};

/**
 * Parse currency string to number
 */
export const parseCurrency = (str) => {
  return parseInt(str.replace(/[^\d]/g, '')) || 0;
};

/**
 * Format date to YYYY-MM-DD (for input fields)
 */
export const formatDate = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Format date to dd/mm/yyyy (for display)
 */
export const formatDateDisplay = (date) => {
  if (!date) return '';
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${day}/${month}/${year}`;
};

const WEEKDAYS_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
// "2026-11-04" hoặc nửa đêm UTC "2026-11-04T00:00:00.000000Z" (Laravel cast date) là một ngày lịch:
// đọc thẳng năm/tháng/ngày, không qua giờ UTC.
const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?Z)?$/;

const toLocalDate = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const match = CALENDAR_DATE.exec(value);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Ngày ngắn cho danh sách (M6): cùng năm "T4, 04/11"; khác năm "04/11/2025".
 * `now` để test; mặc định là lúc gọi.
 */
export const formatDateShort = (date, now = new Date()) => {
  const d = toLocalDate(date);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  if (d.getFullYear() !== now.getFullYear()) return `${day}/${month}/${d.getFullYear()}`;
  return `${WEEKDAYS_SHORT[d.getDay()]}, ${day}/${month}`;
};

const WEEKDAYS_LONG = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

/** Ngày kèm thứ cho tiêu đề ảnh xuất bill chính: "09-11-2026 (Thứ 2)". */
export const formatDateWithWeekday = (date) => {
  const d = toLocalDate(date);
  if (!d) return '';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}-${month}-${d.getFullYear()} (${WEEKDAYS_LONG[d.getDay()]})`;
};

/** Giờ ngắn "21:13" (24 giờ, giờ máy), vd giờ đánh dấu đã thanh toán. */
export const formatTimeShort = (date) => {
  const d = toLocalDate(date);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Format ratio value (remove trailing zeros)
 * Examples: 1.000 -> 1, 0.700 -> 0.7, 1.5 -> 1.5
 */
export const formatRatio = (value) => {
  if (value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  // Mức tính lưu 3 chữ số thập phân: làm tròn để bỏ sai số khi cộng (22.250000000000004),
  // đổi về number để bỏ số 0 thừa
  return Number(num.toFixed(3)).toString();
};

/** Đơn giá cầu cho bill: API trả price_for_bill khi gọi kèm as_of, không thì dùng price. */
export const shuttleUnitPrice = (type) => {
  if (!type) return 0;
  const v = type.price_for_bill ?? type.price;
  return Number(v) || 0;
};

/**
 * Calculate bill preview
 */
export const calculateBillPreview = (courtTotal, shuttles, players) => {
  // Calculate total shuttle price
  const totalShuttlePrice = shuttles.reduce((sum, s) => {
    return sum + (s.price * s.quantity);
  }, 0);

  // Total amount
  const totalAmount = courtTotal + totalShuttlePrice;

  // Sum of ratios
  const sumRatios = players.reduce((sum, p) => sum + (p.ratio_value || 0), 0);

  // Unit price
  const unitPrice = sumRatios > 0 ? totalAmount / sumRatios : 0;

  // Calculate per player
  const playersWithAmounts = players.map((player) => {
    const shareAmount = Math.round((player.ratio_value || 0) * unitPrice);
    // Chi phí thêm = menu nước + tiền cộng thêm kèm nội dung
    const menuTotal = playerExtraTotal(player);
    const debtAmount = player.debt_amount || 0;
    const playerTotalAmount = shareAmount + menuTotal + debtAmount;

    return {
      ...player,
      share_amount: shareAmount,
      menu_extra_total: menuTotal,
      debt_amount: debtAmount,
      total_amount: playerTotalAmount,
    };
  });

  // Calculate rounding difference
  // Note: Only share amounts are included in rounding, menu and debt are exact
  const calculatedShareTotal = playersWithAmounts.reduce((sum, p) => sum + p.share_amount, 0);
  const roundingDifference = totalAmount - calculatedShareTotal;

  return {
    total_shuttle_price: totalShuttlePrice,
    total_amount: totalAmount,
    sum_ratios: sumRatios,
    unit_price: unitPrice,
    players: playersWithAmounts,
    rounding_difference: roundingDifference,
  };
};

