import { formatCurrency, roundToNearestThousand } from "./formatters";

/**
 * Tổng tiền của một bill cầu lông, tính từ bill_players của API chi tiết bill.
 *
 * Mỗi người trả số đã làm tròn đến nghìn, nên mọi tổng phải cộng các số đã làm
 * tròn — làm tròn tổng thô thì lệch với các dòng (bill 15 người x 52.533 hiện
 * 53.000/người nhưng tổng thô làm tròn chỉ ra 788.000 thay vì 795.000).
 */

/** Số tiền một người phải trả: tiền bill (đánh + menu) cộng nợ cũ, làm tròn nghìn. */
export const playerDueAmount = (player) =>
  roundToNearestThousand(
    (Number(player.total_amount) || 0) + (Number(player.debt_amount) || 0),
  );

/** Tổng cộng: tổng số tiền đã làm tròn của từng người. */
export const billCollectedTotal = (players = []) =>
  (players || []).reduce((sum, player) => sum + playerDueAmount(player), 0);

/**
 * Tổng tiền đánh: tổng cộng trừ nợ cũ và tiền menu (chỉ thu hộ, chi lại đúng
 * bằng đó). Đem số này trừ tiền sân + tiền cầu ra tiền lời của buổi.
 */
export const billPlayingTotal = (players = []) =>
  (players || []).reduce(
    (sum, player) =>
      sum +
      playerDueAmount(player) -
      (Number(player.debt_amount) || 0) -
      (Number(player.menu_extra_total) || 0),
    0,
  );

/**
 * Tiền lời của bill: tổng tiền đánh trừ tổng tiền bill (tiền sân + tiền cầu).
 * Âm khi làm tròn từng người thu thiếu. Chỉ hiện ở màn chi tiết để quản lý,
 * không đưa vào ảnh xuất bill (BillExport.jsx).
 */
export const billProfit = (bill) =>
  billPlayingTotal(bill.bill_players) - (Number(bill.total_amount) || 0);

/** Tiền lời có dấu: "+7.000 ₫", "-3.000 ₫", "0 ₫". */
export const formatProfit = (value) =>
  `${value > 0 ? "+" : ""}${formatCurrency(value)}`;
