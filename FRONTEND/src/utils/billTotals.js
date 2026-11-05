import { formatCurrency, roundToNearestThousand } from "./formatters";

/**
 * Tổng tiền của một bill cầu lông, tính từ bill_players của API chi tiết bill.
 *
 * Mỗi người trả số đã làm tròn đến nghìn, nên mọi tổng phải cộng các số đã làm
 * tròn — làm tròn tổng thô thì lệch với các dòng (bill 15 người x 52.533 hiện
 * 53.000/người nhưng tổng thô làm tròn chỉ ra 788.000 thay vì 795.000).
 */

/**
 * Người chơi có chi phí thêm (menu nước hoặc tiền cộng thêm kèm nội dung) để
 * hiện khối "Chi phí thêm" ở chi tiết / xuất bill.
 */
export const hasExtraCosts = (player = {}) =>
  (player.bill_player_menus || []).length > 0 ||
  (Number(player.extra_amount) || 0) !== 0;

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

/**
 * "Tiền/người": tổng tiền bill chia tổng mức tính (thiếu mức tính coi là 1),
 * làm tròn đồng — cùng cách tính với thẻ Thông tin Bill và ảnh xuất.
 */
export const billPerPersonAmount = (players = [], totalAmount = 0) => {
  const sumRatios = (players || []).reduce(
    (sum, player) => sum + Number(player.ratio_value ?? 1.0),
    0,
  );
  return sumRatios > 0 ? Math.round((Number(totalAmount) || 0) / sumRatios) : 0;
};

/** Tiền lời có dấu: "+7.000 ₫", "-3.000 ₫", "0 ₫". */
export const formatProfit = (value) =>
  `${value > 0 ? "+" : ""}${formatCurrency(value)}`;

/**
 * Tiền của một người ở từng bill con (đã làm tròn nghìn), bỏ bill con người đó
 * không chơi hoặc tiền bằng 0. Nhãn là ghi chú bill con, không có thì "Bill sau".
 */
export const playerSubBillLines = (player, subBills = []) =>
  (subBills || []).flatMap((subBill) => {
    const subBillPlayer = subBill.bill_players?.find(
      (p) => p.user_id === player.user_id,
    );
    if (!subBillPlayer) return [];
    const amount = playerDueAmount(subBillPlayer);
    return amount
      ? [{ id: subBill.id, label: subBill.note || "Bill sau", amount }]
      : [];
  });

/**
 * "TT + Bill sau": số phải trả của bill chính (gồm nợ cũ) cộng tiền từng bill
 * con, làm tròn từng số trước khi cộng (như BillContent / ảnh xuất).
 */
export const playerTotalWithSubBills = (player, subBills = []) =>
  playerDueAmount(player) +
  playerSubBillLines(player, subBills).reduce(
    (sum, line) => sum + line.amount,
    0,
  );

/**
 * Số thu khi chọn "Chỉ bill hiện tại" ở hộp nợ cũ: tiền bill (không gồm nợ cũ)
 * cộng các bill con, vì đánh dấu bill chính thì bill con được đánh dấu theo.
 */
export const playerCurrentOnlyAmount = (player, subBills = []) =>
  roundToNearestThousand(Number(player.total_amount) || 0) +
  playerSubBillLines(player, subBills).reduce(
    (sum, line) => sum + line.amount,
    0,
  );

/**
 * Tiến độ thu tiền của bill: số người đã / chưa trả, tiền còn thiếu và tổng
 * phải thu (mỗi người tính "TT + Bill sau").
 */
export const billCollection = (players = [], subBills = []) =>
  (players || []).reduce(
    (acc, player) => {
      const amount = playerTotalWithSubBills(player, subBills);
      acc.total += 1;
      acc.totalAmount += amount;
      if (player.is_paid) {
        acc.paid += 1;
      } else {
        acc.unpaid += 1;
        acc.unpaidAmount += amount;
      }
      return acc;
    },
    { total: 0, paid: 0, unpaid: 0, unpaidAmount: 0, totalAmount: 0 },
  );
