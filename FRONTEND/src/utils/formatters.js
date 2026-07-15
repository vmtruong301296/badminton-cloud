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

/**
 * Format ratio value (remove trailing zeros)
 * Examples: 1.000 -> 1, 0.700 -> 0.7, 1.5 -> 1.5
 */
export const formatRatio = (value) => {
  if (value === null || value === undefined) return '';
  const num = parseFloat(value);
  if (isNaN(num)) return '';
  // Remove trailing zeros by converting to number and back to string
  return num.toString();
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
    const menuTotal = (player.menus || []).reduce((sum, m) => sum + (m.subtotal || 0), 0);
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

