import { formatCurrencyRounded, formatDate, formatDateDisplay, formatRatio, roundToNearestThousand } from '../../utils/formatters';

export default function BillContent({ bill, showHeader = true, onMarkPayment, isMainBill = false, subBills = null }) {
  if (!bill) return null;

  return (
    <div className="h-full flex flex-col">
      {showHeader && (
        <div className="mb-4 pb-4 border-b">
          <h3 className="text-xl font-bold">Bill #{bill.id}</h3>
          <p className="text-sm text-gray-600">Ngày: {formatDate(bill.date)}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-4">
        {/* Bill Info */}
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <div className="text-xs text-gray-600">Tổng tiền sân</div>
              <div className="text-sm font-semibold">{formatCurrencyRounded(bill.court_total)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Tổng tiền cầu</div>
              <div className="text-sm font-semibold">{formatCurrencyRounded(bill.total_shuttle_price)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-600">Tổng tiền</div>
              <div className="text-sm font-bold text-blue-600">{formatCurrencyRounded(bill.total_amount)}</div>
            </div>
          </div>
        </div>

        {/* Shuttles */}
        {bill.bill_shuttles && bill.bill_shuttles.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h4 className="text-sm font-semibold mb-3">Chi tiết cầu</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-1">Loại cầu</th>
                    <th className="text-right py-1">SL</th>
                    <th className="text-right py-1">Đơn giá</th>
                    <th className="text-right py-1">Thành tiền</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.bill_shuttles.map((shuttle, index) => (
                    <tr key={index} className="border-b">
                      <td className="py-1">{shuttle.shuttle_type?.name}</td>
                      <td className="text-right py-1">{shuttle.quantity}</td>
                      <td className="text-right py-1">{formatCurrencyRounded(shuttle.price_each)}</td>
                      <td className="text-right py-1 font-semibold">
                        {formatCurrencyRounded(shuttle.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Players Table */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h4 className="text-sm font-semibold mb-3">Chi tiết người chơi</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1">STT</th>
                  <th className="text-left py-1">Tên</th>
                  <th className="text-right py-1">Mức tính</th>
                  <th className="text-right py-1">Chi phí thêm</th>
                  <th className="text-right py-1">Tiền nợ</th>
                  <th className="text-right py-1">Tổng tiền</th>
                  {subBills && subBills.length > 0 && (
                    <th className="text-right py-1">TT + Bill sau</th>
                  )}
                  <th className="text-center py-1">Đã TT</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
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
                  
                  return sortedPlayers.map((player, index) => (
                  <tr 
                    key={player.id} 
                    className={`border-b ${!player.is_paid ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}
                  >
                    <td className="py-2">{index + 1}</td>
                    <td className="py-2 font-medium">{player.user?.name}</td>
                    <td className="text-right py-2">{formatRatio(player.ratio_value)}</td>
                    <td className="text-right py-2">
                      {player.menu_extra_total > 0 ? (
                        <div className="text-right">
                          <div className="font-semibold mb-1">
                            {formatCurrencyRounded(player.menu_extra_total)}
                          </div>
                          <div className="text-xs text-gray-600 space-y-1">
                            {player.bill_player_menus?.map((menuItem, idx) => (
                              <div key={idx} className="text-right">
                                {menuItem.menu?.name} × {menuItem.quantity} = {formatCurrencyRounded(menuItem.subtotal)}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-right py-2">
                      {player.debt_amount > 0 ? (
                        <div>
                          <div className="font-semibold mb-1">{formatCurrencyRounded(player.debt_amount)}</div>
                          {player.debt_details && player.debt_details.length > 0 && (
                            <div className="text-xs text-gray-600 space-y-2">
                              {player.debt_details.map((debt, idx) => (
                                <div key={idx} className="text-right border border-gray-300 rounded p-1.5 bg-gray-50">
                                  {debt.parent_amount !== null && (
                                    <div className="font-medium">
                                      {formatDateDisplay(debt.date)}: {formatCurrencyRounded(debt.parent_amount)}
                                    </div>
                                  )}
                                  {debt.sub_bills && debt.sub_bills.length > 0 && debt.sub_bills.map((subBill, subIdx) => (
                                    <div key={subIdx} className="pl-2 mt-0.5">
                                      {subBill.note || 'Sau 9h'}: {formatCurrencyRounded(subBill.amount)}
                                    </div>
                                  ))}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="text-right py-2 font-semibold">
                      {(() => {
                        // Giá trị cột "Tổng tiền" = total_amount + debt_amount
                        return formatCurrencyRounded((player.total_amount || 0) + (player.debt_amount || 0));
                      })()}
                    </td>
                    {subBills && subBills.length > 0 && (
                      <td className="text-right py-2 font-semibold text-green-600">
                        {(() => {
                          // Kiểm tra xem bill con có tiền dương không
                          const hasSubBillWithMoney = subBills.some((subBill) => {
                            const subBillPlayer = subBill.bill_players?.find((p) => p.user_id === player.user_id);
                            if (subBillPlayer) {
                              const subBillTotalAmount = (subBillPlayer.total_amount || 0) + (subBillPlayer.debt_amount || 0);
                              return subBillTotalAmount > 0;
                            }
                            return false;
                          });
                          
                          // Nếu không có bill con nào có tiền dương, hiển thị rỗng
                          if (!hasSubBillWithMoney) {
                            return '';
                          }
                          
                          // Lấy giá trị cột "Tổng tiền" trong bill chính (total_amount + debt_amount)
                          // Làm tròn từng giá trị trước khi cộng để nhất quán với hiển thị
                          const mainBillTotalAmount = roundToNearestThousand((player.total_amount || 0) + (player.debt_amount || 0));
                          
                          // Lấy tổng giá trị cột "Tổng tiền" trong tất cả bill phụ
                          // Làm tròn từng giá trị trước khi cộng để nhất quán với hiển thị
                          const subBillsTotalAmount = subBills.reduce((sum, subBill) => {
                            const subBillPlayer = subBill.bill_players?.find((p) => p.user_id === player.user_id);
                            if (subBillPlayer) {
                              // Giá trị cột "Tổng tiền" của player trong bill phụ
                              const subBillTotalAmount = roundToNearestThousand((subBillPlayer.total_amount || 0) + (subBillPlayer.debt_amount || 0));
                              return sum + subBillTotalAmount;
                            }
                            return sum;
                          }, 0);
                          
                          // Tổng tiền 2 bill = Tổng tiền bill chính + Tổng tiền bill phụ
                          return formatCurrencyRounded(mainBillTotalAmount + subBillsTotalAmount);
                        })()}
                      </td>
                    )}
                    <td className="text-center py-2">
                      {isMainBill && onMarkPayment ? (
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
                          className="w-4 h-4 cursor-pointer"
                        />
                      ) : (
                        <div className="flex items-center justify-center">
                          {player.is_paid ? (
                            <div 
                              className="w-4 h-4 border-2 border-blue-600 bg-blue-600 rounded flex items-center justify-center"
                              style={{ cursor: 'not-allowed' }}
                            >
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          ) : (
                            <div 
                              className="w-4 h-4 border-2 border-gray-400 bg-white rounded"
                              style={{ cursor: 'not-allowed', opacity: 0.6 }}
                            />
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                  ));
                })()}
              </tbody>
              <tfoot>
                <tr className="border-t-2 font-bold">
                  <td colSpan="5" className="py-2 text-right">Tổng cộng:</td>
                  <td className="text-right py-2">
                    {formatCurrencyRounded(
                      bill.bill_players?.reduce((sum, p) => sum + (p.total_amount || 0) + (p.debt_amount || 0), 0) || 0
                    )}
                  </td>
                  {subBills && subBills.length > 0 && (
                    <td className="text-right py-2 text-green-600">
                      {(() => {
                        // Kiểm tra xem có bất kỳ bill con nào có tiền dương không
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
                        
                        // Nếu không có bill con nào có tiền dương, hiển thị rỗng
                        if (!hasAnySubBillWithMoney) {
                          return '';
                        }
                        
                        // Tính tổng tiền 2 bill
                        // Làm tròn từng giá trị trước khi cộng để nhất quán với hiển thị
                        return formatCurrencyRounded(
                          bill.bill_players?.reduce((sum, p) => {
                            // Lấy giá trị cột "Tổng tiền" trong bill chính (làm tròn trước)
                            const mainBillTotalAmount = roundToNearestThousand((p.total_amount || 0) + (p.debt_amount || 0));
                            
                            // Lấy tổng giá trị cột "Tổng tiền" trong tất cả bill phụ (làm tròn từng giá trị trước)
                            const subBillsTotalAmount = subBills.reduce((subSum, subBill) => {
                              const subBillPlayer = subBill.bill_players?.find((sp) => sp.user_id === p.user_id);
                              if (subBillPlayer) {
                                // Giá trị cột "Tổng tiền" của player trong bill phụ (làm tròn trước)
                                const subBillTotalAmount = roundToNearestThousand((subBillPlayer.total_amount || 0) + (subBillPlayer.debt_amount || 0));
                                return subSum + subBillTotalAmount;
                              }
                              return subSum;
                            }, 0);
                            
                            // Tổng tiền 2 bill = Tổng tiền bill chính + Tổng tiền bill phụ
                            return sum + mainBillTotalAmount + subBillsTotalAmount;
                          }, 0) || 0
                        );
                      })()}
                    </td>
                  )}
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

