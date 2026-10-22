import { formatCurrency, formatCurrencyRounded, formatRatio } from '../../utils/formatters';
import { CircleAlert } from '../ui/icons';

export default function BillSummary({ preview }) {
  if (!preview) return null;

  return (
    <div className="card">
      <h2 className="mb-4 text-base font-semibold text-slate-900">Tóm tắt Bill</h2>

      <div className="space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Tổng tiền sân:</span>
          <span className="font-tabular font-medium text-slate-900">{formatCurrencyRounded(preview.court_total || 0)}</span>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Tổng tiền cầu:</span>
          <span className="font-tabular font-medium text-slate-900">{formatCurrencyRounded(preview.total_shuttle_price || 0)}</span>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2.5">
          <span className="font-semibold text-emerald-800">Tổng tiền:</span>
          <span className="font-tabular text-lg font-semibold tracking-tight text-emerald-700">{formatCurrencyRounded(preview.total_amount || 0)}</span>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 text-slate-500">Thông tin tính toán:</div>
          <div className="space-y-1 text-slate-700">
            <div className="flex justify-between gap-3">
              <span>Tổng mức tính:</span>
              <span className="font-tabular">{formatRatio(preview.sum_ratios || 0)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span>Unit price:</span>
              <span className="font-tabular">{preview.unit_price ? formatCurrencyRounded(Math.round(preview.unit_price)) : '0đ'}</span>
            </div>
          </div>
        </div>

        {Math.abs(preview.rounding_difference || 0) > 1 && (
          <div className="border-t border-slate-100 pt-4">
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
              <CircleAlert className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <div>
                Chênh lệch làm tròn: {formatCurrency(Math.abs(preview.rounding_difference))}
                <div className="mt-1 text-xs">
                  (Sẽ được xử lý bởi backend khi tạo bill)
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 pt-4">
          <div className="mb-2 font-medium text-slate-900">
            Chi tiết từng người <span className="font-normal text-slate-500">({preview.players?.length || 0})</span>
          </div>
          <div className="max-h-[48rem] space-y-2 overflow-y-auto">
            {preview.players?.map((player, index) => (
              <div key={index} className="rounded-xl bg-slate-50 p-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-tabular font-medium text-slate-500">{index + 1}.</span>
                    <span className="min-w-0 break-words font-medium text-slate-900">{player.name}</span>
                    {player.gender && (
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                        player.gender === 'male'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-pink-100 text-pink-700'
                      }`}>
                        {player.gender === 'male' ? 'Nam' : 'Nữ'}
                      </span>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-right text-xs text-slate-600">
                    {player.menus && player.menus.length > 0 && (
                      <div>
                        <div>Menu: {formatCurrencyRounded(player.menu_extra_total || 0)}</div>
                        <div className="mt-0.5 space-y-0.5 text-slate-500">
                          {player.menus.map((menu, menuIdx) => (
                            <div key={menuIdx} className="text-right">
                              {menu.name} × {menu.quantity} = {formatCurrency(menu.subtotal || 0)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {player.debt_amount > 0 && (
                      <div className="text-rose-600">Nợ: {formatCurrencyRounded(player.debt_amount)}</div>
                    )}
                    <div className="font-tabular mt-1 border-t border-slate-200 pt-1 font-semibold text-slate-900">
                      Tổng: {formatCurrencyRounded(player.total_amount || 0)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
