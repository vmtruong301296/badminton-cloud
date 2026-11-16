import BillPaymentGroup from "./BillPaymentGroup";
import {
  groupBillPlayersByPaid,
  sortBillPlayers,
} from "../../utils/billPlayers";
import { playerWeightLabel } from "../../utils/matchBill";
import {
  formatCurrency,
  formatCurrencyRounded,
  formatDateDisplay,
  formatRatio,
} from "../../utils/formatters";
import {
  billCollectedTotal,
  billPlayingTotal,
  billProfit,
  formatProfit,
  hasExtraCosts,
} from "../../utils/billTotals";

// Bảng của hai nhóm và bảng tổng là ba <table> riêng: cùng độ rộng cột (table-fixed) để cột thẳng hàng.
const COLUMN_WIDTHS = ["6%", "22%", "10%", "18%", "18%", "13%", "13%"];

function ColumnWidths() {
  return (
    <colgroup>
      {COLUMN_WIDTHS.map((width, idx) => (
        <col key={idx} style={{ width }} />
      ))}
    </colgroup>
  );
}

function TableHead({ weightLabel }) {
  const headers = [
    ["STT", "text-left"],
    ["Tên", "text-left"],
    [weightLabel, "text-right"],
    ["Chi phí thêm", "text-right"],
    ["Tiền nợ", "text-right"],
    ["Tổng tiền", "text-right"],
    ["Đã thanh toán", "text-center"],
  ];
  return (
    <thead className="border-b border-slate-100 text-xs font-medium text-slate-500">
      <tr>
        {headers.map(([label, align]) => (
          <th key={label} scope="col" className={`px-4 py-2.5 ${align}`}>
            {label}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function ExtraCostsCell({ player }) {
  if (!hasExtraCosts(player)) return "-";
  return (
    <>
      <div className="font-tabular mb-1 font-semibold">
        {formatCurrencyRounded(player.menu_extra_total || 0)}
      </div>
      <div className="space-y-1 text-xs text-slate-500">
        {(player.bill_player_menus || []).map((menuItem, idx) => (
          <div key={idx}>
            {menuItem.menu?.name} × {menuItem.quantity} ={" "}
            {formatCurrency(menuItem.subtotal)}
          </div>
        ))}
        {Number(player.extra_amount) ? (
          <div>
            {player.extra_note || "Cộng thêm"} ={" "}
            {formatCurrency(player.extra_amount)}
          </div>
        ) : null}
      </div>
    </>
  );
}

function DebtCell({ player }) {
  if (!(player.debt_amount > 0)) return "-";
  return (
    <>
      <div className="font-tabular mb-1 font-semibold text-amber-800">
        {formatCurrencyRounded(player.debt_amount)}
      </div>
      <div className="space-y-2 text-xs text-slate-600">
        {(player.debt_details || []).map((debt, idx) => (
          <div
            key={idx}
            className="rounded-lg border border-amber-200 bg-amber-50/60 p-1.5"
          >
            {debt.parent_amount !== null && (
              <div className="font-medium">
                {formatDateDisplay(debt.date)}:{" "}
                {formatCurrencyRounded(debt.parent_amount)}
              </div>
            )}
            {(debt.sub_bills || []).map((subBill, subIdx) => (
              <div key={subIdx} className="mt-0.5 pl-2">
                {subBill.note || "Bill con"}:{" "}
                {formatCurrencyRounded(subBill.amount)}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/** Một hàng người chơi; người đã trả chữ nhạt hơn (giống hàng trên điện thoại). */
function PlayerRow({ player, stt, canMark, saving, onMarkPayment }) {
  const paid = Boolean(player.is_paid);
  return (
    <tr className={`align-top ${paid ? "bg-slate-50/60" : ""}`}>
      <td className="font-tabular px-4 py-3">{stt}</td>
      <td
        className={`break-words px-4 py-3 ${paid ? "font-medium text-slate-600" : "font-semibold text-slate-900"}`}
      >
        {player.user?.name}
      </td>
      <td className="font-tabular px-4 py-3 text-right">
        {formatRatio(player.ratio_value)}
      </td>
      <td className="px-4 py-3 text-right">
        <ExtraCostsCell player={player} />
      </td>
      <td className="px-4 py-3 text-right">
        <DebtCell player={player} />
      </td>
      <td
        className={`font-tabular px-4 py-3 text-right ${paid ? "font-medium text-slate-500" : "font-bold text-slate-900"}`}
      >
        {formatCurrencyRounded(
          (player.total_amount || 0) + (player.debt_amount || 0),
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <input
          type="checkbox"
          checked={paid}
          aria-label={`Đã thanh toán: ${player.user?.name || ""}`}
          onChange={(e) => onMarkPayment(player.user_id, e.target.checked)}
          disabled={!canMark || saving}
          className="h-5 w-5 cursor-pointer accent-emerald-700 disabled:cursor-not-allowed"
        />
        {player.paid_at && (
          <div className="font-tabular mt-1 text-xs text-slate-500">
            {new Date(player.paid_at).toLocaleString("vi-VN")}
          </div>
        )}
      </td>
    </tr>
  );
}

function TotalLine({ label, value, strong = false, valueClass = "" }) {
  return (
    <tr className={strong ? "font-bold text-slate-900" : "text-slate-600"}>
      <td colSpan={5} className="px-4 py-1.5 text-right">
        {label}
      </td>
      <td className={`font-tabular px-4 py-1.5 text-right ${valueClass}`}>
        {value}
      </td>
      <td />
    </tr>
  );
}

function BillTotalsTable({ bill }) {
  const players = bill.bill_players || [];
  const profit = billProfit(bill);
  return (
    <table className="w-full table-fixed text-sm">
      <ColumnWidths />
      <tbody>
        <TotalLine
          strong
          label="Tổng cộng:"
          value={formatCurrencyRounded(billCollectedTotal(players))}
        />
        <TotalLine
          label={
            <>
              Tổng tiền đánh{" "}
              <span className="text-slate-400">(không gồm nợ cũ, menu):</span>
            </>
          }
          value={formatCurrencyRounded(billPlayingTotal(players))}
          valueClass="font-semibold text-slate-700"
        />
        <TotalLine
          label={
            <>
              Tiền lời{" "}
              <span className="text-slate-400">
                (tiền đánh − tổng tiền bill):
              </span>
            </>
          }
          value={formatProfit(profit)}
          valueClass={`font-semibold ${profit < 0 ? "text-rose-600" : "text-emerald-700"}`}
        />
      </tbody>
    </table>
  );
}

/**
 * Bảng "Chi tiết người chơi" trên web của bill không có bill con: hai khối tách riêng
 * "Chưa thanh toán" (trên) và "Đã thanh toán" (dưới), rồi dòng tổng. STT liên tục qua hai khối,
 * cùng thứ tự với ảnh xuất (BillExport.jsx).
 *
 * - canMark: có quyền bills.mark_payment; savingIds: Set user_id đang lưu.
 * - onMarkPayment(userId, isPaid).
 */
export default function BillPlayersTable({
  bill,
  canMark = false,
  savingIds,
  onMarkPayment,
}) {
  const sorted = sortBillPlayers(bill.bill_players);
  const sttOf = new Map(sorted.map((player, idx) => [player.id, idx + 1]));
  const weightLabel = playerWeightLabel(bill);

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <h2 className="text-base font-semibold text-slate-900">
          Chi tiết người chơi
        </h2>
        <span className="font-tabular text-sm text-slate-500">
          {sorted.length} người
        </span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        {groupBillPlayersByPaid(sorted).map((group) => (
          <BillPaymentGroup
            key={group.key}
            paid={group.paid}
            count={group.players.length}
          >
            <table className="w-full table-fixed text-sm text-slate-700">
              <ColumnWidths />
              <TableHead weightLabel={weightLabel} />
              <tbody className="divide-y divide-slate-100">
                {group.players.map((player) => (
                  <PlayerRow
                    key={player.id}
                    player={player}
                    stt={sttOf.get(player.id)}
                    canMark={canMark}
                    saving={Boolean(savingIds?.has(player.user_id))}
                    onMarkPayment={onMarkPayment}
                  />
                ))}
              </tbody>
            </table>
          </BillPaymentGroup>
        ))}

        <div className="border-t border-slate-200 pt-2">
          <BillTotalsTable bill={bill} />
        </div>
      </div>
    </div>
  );
}
