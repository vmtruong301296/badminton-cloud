import { formatCurrencyRounded, formatDate, formatDateDisplay, formatRatio, roundToNearestThousand } from '../../utils/formatters';

// Hiển thị bill trên màn hình chi tiết (KHÔNG phải ảnh xuất: ảnh xuất do BillExport.jsx dựng riêng).
// Danh sách người chơi dạng hàng/thẻ thay cho bảng 8 cột: cột chứa nó chỉ rộng ~600 px trên desktop
// (bố cục 2 cột) và ~360 px trên điện thoại, bảng không vừa mà không phải cuộn ngang hoặc bẻ tên 3–4 dòng.

const CheckIcon = ({ className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={className}
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const PAID_PILL =
  'inline-flex h-11 select-none items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition sm:h-9';

export default function BillContent({ bill, showHeader = true, onMarkPayment, isMainBill = false, subBills = null }) {
  if (!bill) return null;

  const hasSubBills = !!(subBills && subBills.length > 0);
  const canMark = isMainBill && onMarkPayment;

  // Sort players: unpaid males -> unpaid females -> paid males -> paid females
  const sortedPlayers = [...(bill.bill_players || [])].sort((a, b) => {
    const aIsPaid = a.is_paid || false;
    const bIsPaid = b.is_paid || false;
    const aGender = a.user?.gender || '';
    const bGender = b.user?.gender || '';

    // First sort by payment status: unpaid first (false < true)
    if (aIsPaid !== bIsPaid) {
      return aIsPaid ? 1 : -1;
    }

    // If same payment status, sort by gender: male first
    if (aGender !== bGender) {
      if (aGender === 'male') return -1;
      if (bGender === 'male') return 1;
    }

    return 0;
  });

  // Bill con có tiền dương của người chơi này không (dùng cho cả 2 cột)
  const playerHasSubBillMoney = (userId) =>
    hasSubBills
      ? subBills.some((subBill) => {
          const subBillPlayer = subBill.bill_players?.find((p) => p.user_id === userId);
          if (subBillPlayer) {
            const subBillTotalAmount = (subBillPlayer.total_amount || 0) + (subBillPlayer.debt_amount || 0);
            return subBillTotalAmount > 0;
          }
          return false;
        })
      : false;

  // Cột "TT + Bill sau": tổng tiền bill chính + tổng tiền các bill phụ (làm tròn từng giá trị trước khi cộng)
  const playerTotalWithSubBills = (player) => {
    const mainBillTotalAmount = roundToNearestThousand((player.total_amount || 0) + (player.debt_amount || 0));
    const subBillsTotalAmount = subBills.reduce((sum, subBill) => {
      const subBillPlayer = subBill.bill_players?.find((p) => p.user_id === player.user_id);
      if (subBillPlayer) {
        const subBillTotalAmount = roundToNearestThousand((subBillPlayer.total_amount || 0) + (subBillPlayer.debt_amount || 0));
        return sum + subBillTotalAmount;
      }
      return sum;
    }, 0);
    return mainBillTotalAmount + subBillsTotalAmount;
  };

  const renderPaidControl = (player) => {
    if (canMark) {
      return (
        <label
          className={`${PAID_PILL} cursor-pointer border-slate-200 bg-white text-slate-600 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-100 has-[:checked]:text-emerald-800 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-600/40`}
        >
          <input
            type="checkbox"
            checked={player.is_paid || false}
            onChange={(e) => {
              if (player.is_paid && !e.target.checked) {
                e.preventDefault();
                onMarkPayment(player.user_id, false);
              } else {
                onMarkPayment(player.user_id, e.target.checked);
              }
            }}
            className="sr-only"
          />
          {player.is_paid ? (
            <CheckIcon className="h-3.5 w-3.5" />
          ) : (
            <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-400" aria-hidden="true" />
          )}
          Đã TT
        </label>
      );
    }
    return (
      <span
        className={`${PAID_PILL} ${
          player.is_paid ? 'border-emerald-300 bg-emerald-100 text-emerald-800' : 'border-slate-200 bg-white text-slate-400'
        }`}
        role="img"
        aria-label={player.is_paid ? 'Đã TT' : 'Chưa TT'}
      >
        {player.is_paid ? (
          <CheckIcon className="h-3.5 w-3.5" />
        ) : (
          <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300" aria-hidden="true" />
        )}
        Đã TT
      </span>
    );
  };

  const mainTotalSum =
    bill.bill_players?.reduce((sum, p) => sum + (p.total_amount || 0) + (p.debt_amount || 0), 0) || 0;

  // Tổng cột "TT + Bill sau" (rỗng nếu không bill con nào có tiền dương)
  const renderFooterWithSubBills = () => {
    const hasAnySubBillWithMoney = bill.bill_players?.some((p) => {
      return subBills.some((subBill) => {
        const subBillPlayer = subBill.bill_players?.find((sp) => sp.user_id === p.user_id);
        if (subBillPlayer) {
          const subBillTotalAmount = (subBillPlayer.total_amount || 0) + (subBillPlayer.debt_amount || 0);
          return subBillTotalAmount > 0;
        }
        return false;
      });
    });

    if (!hasAnySubBillWithMoney) {
      return '';
    }

    return formatCurrencyRounded(
      bill.bill_players?.reduce((sum, p) => sum + playerTotalWithSubBills(p), 0) || 0
    );
  };

  const footerWithSubBills = hasSubBills ? renderFooterWithSubBills() : '';

  return (
    <div className="h-full flex flex-col">
      {showHeader && (
        <div className="mb-4 border-b border-slate-100 pb-4">
          <h3 className="text-xl font-semibold tracking-tight text-slate-900">Bill #{bill.id}</h3>
          <p className="text-sm text-slate-500">Ngày: {formatDate(bill.date)}</p>
        </div>
      )}

      <div className="flex-1 space-y-4">
        {/* Bill Info */}
        <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <div>
              <div className="text-xs font-medium text-slate-500">Tổng tiền sân</div>
              <div className="font-tabular mt-0.5 text-sm font-semibold text-slate-900">{formatCurrencyRounded(bill.court_total)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-500">Tổng tiền cầu</div>
              <div className="font-tabular mt-0.5 text-sm font-semibold text-slate-900">{formatCurrencyRounded(bill.total_shuttle_price)}</div>
            </div>
            <div>
              <div className="text-xs font-medium text-emerald-700">Tổng tiền</div>
              <div className="font-tabular mt-0.5 text-sm font-semibold text-emerald-700">{formatCurrencyRounded(bill.total_amount)}</div>
            </div>
          </div>
        </div>

        {/* Shuttles */}
        {bill.bill_shuttles && bill.bill_shuttles.length > 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-900">Chi tiết cầu</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="text-xs font-medium text-slate-500">
                    <th className="py-1 text-left font-medium">Loại cầu</th>
                    <th className="py-1 text-right font-medium">SL</th>
                    <th className="py-1 text-right font-medium">Đơn giá</th>
                    <th className="py-1 text-right font-medium">Thành tiền</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {bill.bill_shuttles.map((shuttle, index) => (
                    <tr key={index}>
                      <td className="py-1.5 pr-2">{shuttle.shuttle_type?.name}</td>
                      <td className="font-tabular py-1.5 text-right">{shuttle.quantity}</td>
                      <td className="font-tabular py-1.5 text-right">{formatCurrencyRounded(shuttle.price_each)}</td>
                      <td className="font-tabular py-1.5 text-right font-semibold text-slate-900">
                        {formatCurrencyRounded(shuttle.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Players */}
        <div className="rounded-xl border border-slate-200 bg-white">
          <h4 className="px-3 py-3 text-sm font-semibold text-slate-900 sm:px-4">Chi tiết người chơi</h4>
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {sortedPlayers.map((player, index) => {
              const hasSubBillWithMoney = playerHasSubBillMoney(player.user_id);
              const rowTotal = formatCurrencyRounded((player.total_amount || 0) + (player.debt_amount || 0));
              return (
                <li key={player.id} className={`px-3 py-3 sm:px-4 ${!player.is_paid ? 'bg-rose-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="font-tabular mt-0.5 inline-flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-600">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 break-words text-sm font-medium text-slate-900">{player.user?.name}</div>
                        <div
                          className={`font-tabular flex-shrink-0 text-sm font-semibold ${
                            !hasSubBillWithMoney && hasSubBills ? 'text-emerald-700' : 'text-slate-900'
                          }`}
                        >
                          {rowTotal}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-500">
                          Mức tính <span className="font-tabular font-medium text-slate-700">{formatRatio(player.ratio_value)}</span>
                        </div>
                        {renderPaidControl(player)}
                      </div>

                      {player.bill_player_menus && player.bill_player_menus.length > 0 && (
                        <div className="mt-2 rounded-lg bg-slate-50 p-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-slate-500">Chi phí thêm</span>
                            <span className="font-tabular text-xs font-semibold text-slate-900">
                              {formatCurrencyRounded(player.menu_extra_total || 0)}
                            </span>
                          </div>
                          <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                            {player.bill_player_menus.map((menuItem, idx) => (
                              <div key={idx} className="flex justify-between gap-2">
                                <span className="min-w-0 break-words">
                                  {menuItem.menu?.name} × {menuItem.quantity}
                                </span>
                                <span className="font-tabular flex-shrink-0">{formatCurrencyRounded(menuItem.subtotal)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {player.debt_amount > 0 && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-medium text-amber-800">Tiền nợ</span>
                            <span className="font-tabular text-xs font-semibold text-amber-800">
                              {formatCurrencyRounded(player.debt_amount)}
                            </span>
                          </div>
                          {player.debt_details && player.debt_details.length > 0 && (
                            <div className="mt-1 space-y-1 text-xs text-slate-600">
                              {player.debt_details.map((debt, idx) => (
                                <div key={idx} className="rounded-md border border-amber-100 bg-white/60 p-1.5">
                                  {debt.parent_amount !== null && (
                                    <div className="flex justify-between gap-2">
                                      <span className="font-medium text-slate-700">{formatDateDisplay(debt.date)}</span>
                                      <span className="font-tabular">{formatCurrencyRounded(debt.parent_amount)}</span>
                                    </div>
                                  )}
                                  {debt.sub_bills && debt.sub_bills.length > 0 && debt.sub_bills.map((subBill, subIdx) => (
                                    <div key={subIdx} className="flex justify-between gap-2 pl-2">
                                      <span className="min-w-0 break-words">{subBill.note || 'Sau 9h'}</span>
                                      <span className="font-tabular flex-shrink-0">{formatCurrencyRounded(subBill.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {hasSubBills && hasSubBillWithMoney && (
                        <div className="mt-2 flex items-baseline justify-between gap-2 text-xs">
                          <span className="font-medium text-slate-500">TT + Bill sau</span>
                          <span className="font-tabular font-semibold text-emerald-700">
                            {formatCurrencyRounded(playerTotalWithSubBills(player))}
                          </span>
                        </div>
                      )}

                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Tổng cộng */}
          <div className="rounded-b-xl border-t border-slate-200 bg-emerald-50 px-3 py-3 sm:px-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-900">Tổng cộng:</span>
              <span className="font-tabular text-base font-semibold text-slate-900">{formatCurrencyRounded(mainTotalSum)}</span>
            </div>
            {hasSubBills && footerWithSubBills !== '' && (
              <div className="mt-1 flex items-baseline justify-between gap-3">
                <span className="text-xs font-medium text-slate-500">TT + Bill sau</span>
                <span className="font-tabular text-sm font-semibold text-emerald-700">{footerWithSubBills}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
