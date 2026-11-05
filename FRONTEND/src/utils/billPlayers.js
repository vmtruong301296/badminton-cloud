/**
 * Danh sách người chơi của một bill cầu lông (bill_players của API chi tiết bill):
 * thứ tự hiện, đếm và lọc theo chip ở màn chi tiết trên điện thoại.
 */

/**
 * Chưa trả lên trước, trong mỗi nhóm nam trước nữ — cùng thứ tự với bảng
 * desktop và cột TT của ảnh xuất (BillExport.jsx), nên STT trên hàng khớp ảnh.
 * Bấm "Đã TT" thì hàng xuống nhóm đã trả (giữ như cũ, quyết định 8).
 */
export const sortBillPlayers = (players = []) =>
  [...(players || [])].sort((a, b) => {
    const aIsPaid = a.is_paid || false;
    const bIsPaid = b.is_paid || false;
    if (aIsPaid !== bIsPaid) return aIsPaid ? 1 : -1;

    const aGender = a.user?.gender || "";
    const bGender = b.user?.gender || "";
    if (aGender !== bGender) {
      if (aGender === "male") return -1;
      if (bGender === "male") return 1;
    }
    return 0;
  });

const hasDebt = (player) => (Number(player.debt_amount) || 0) > 0;

const FILTERS = {
  all: () => true,
  unpaid: (player) => !player.is_paid,
  paid: (player) => Boolean(player.is_paid),
  debt: hasDebt,
};

/** Lọc theo chip: "all" | "unpaid" | "paid" | "debt" (lạ thì như "all"). */
export const filterBillPlayers = (players = [], filter = "all") =>
  (players || []).filter(FILTERS[filter] || FILTERS.all);

/** Số người trên từng chip lọc. */
export const countBillPlayers = (players = []) => ({
  all: (players || []).length,
  unpaid: filterBillPlayers(players, "unpaid").length,
  paid: filterBillPlayers(players, "paid").length,
  debt: filterBillPlayers(players, "debt").length,
});

/**
 * Id các bill cũ người này còn nợ (bill chính và bill con trong debt_details),
 * để đánh dấu đã trả khi chọn "Cả bill cũ". Không trùng, giữ thứ tự gặp.
 */
export const oldBillIdsOf = (player = {}) => {
  const ids = new Set();
  (player.debt_details || []).forEach((debt) => {
    if (debt.parent_bill_id) ids.add(debt.parent_bill_id);
    (debt.sub_bills || []).forEach((subBill) => {
      if (subBill.bill_id) ids.add(subBill.bill_id);
    });
  });
  return Array.from(ids);
};
