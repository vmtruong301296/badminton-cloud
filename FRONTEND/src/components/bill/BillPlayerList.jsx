import { useState } from "react";
import BillPlayerRow, { BillPlayerTag } from "./BillPlayerRow";
import EmptyState from "../ui/EmptyState";
import { CircleCheck, Clock } from "../ui/icons";
import {
  formatCurrency,
  formatCurrencyRounded,
  formatDateShort,
  formatRatio,
  formatTimeShort,
} from "../../utils/formatters";
import {
  billCollectedTotal,
  billPlayingTotal,
  billProfit,
  formatProfit,
  hasExtraCosts,
  playerDueAmount,
  playerSubBillLines,
  playerTotalWithSubBills,
} from "../../utils/billTotals";
import {
  countBillPlayers,
  filterBillPlayers,
  sortBillPlayers,
} from "../../utils/billPlayers";

const FILTER_CHIPS = [
  { key: "all", label: "Tất cả" },
  { key: "unpaid", label: "Chưa TT" },
  { key: "paid", label: "Đã TT" },
  { key: "debt", label: "Nợ cũ" },
];

function DetailLine({ label, value, indent = false }) {
  return (
    <div className={`flex justify-between gap-3 ${indent ? "pl-3" : ""}`}>
      <span className="min-w-0 break-words">{label}</span>
      <span className="flex-none tabular-nums">{value}</span>
    </div>
  );
}

/** Chi tiết mở tại chỗ của một người: mức tính, chi phí thêm, nợ cũ, bill chính + bill sau. */
function BillPlayerDetail({ player, subBillLines }) {
  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600">
        <DetailLine
          label="Mức tính"
          value={
            <b className="font-semibold text-slate-900">
              {formatRatio(player.ratio_value)}
            </b>
          }
        />
      </div>

      {hasExtraCosts(player) && (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600">
          <DetailLine
            label={<span className="font-medium">Chi phí thêm</span>}
            value={
              <b className="font-semibold text-slate-900">
                {formatCurrencyRounded(player.menu_extra_total || 0)}
              </b>
            }
          />
          {(player.bill_player_menus || []).map((menuItem, idx) => (
            <DetailLine
              key={idx}
              indent
              label={`${menuItem.menu?.name} × ${menuItem.quantity}`}
              value={formatCurrency(menuItem.subtotal)}
            />
          ))}
          {Number(player.extra_amount) ? (
            <DetailLine
              indent
              label={player.extra_note || "Cộng thêm"}
              value={formatCurrency(player.extra_amount)}
            />
          ) : null}
        </div>
      )}

      {player.debt_amount > 0 && (
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[13px] text-slate-600">
          <DetailLine
            label={<span className="font-medium text-amber-800">Tiền nợ</span>}
            value={
              <b className="font-semibold text-amber-800">
                {formatCurrencyRounded(player.debt_amount)}
              </b>
            }
          />
          {(player.debt_details || []).map((debt, idx) => (
            <div key={idx} className="space-y-1">
              <DetailLine
                label={formatDateShort(debt.date)}
                value={
                  debt.parent_amount !== null &&
                  debt.parent_amount !== undefined
                    ? formatCurrencyRounded(debt.parent_amount)
                    : ""
                }
              />
              {(debt.sub_bills || []).map((subBill, subIdx) => (
                <DetailLine
                  key={subIdx}
                  indent
                  label={subBill.note || "Bill con"}
                  value={formatCurrencyRounded(subBill.amount)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {subBillLines.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-sky-200 bg-white text-[13px] text-slate-600">
          <div className="space-y-1 px-3 py-2">
            <DetailLine
              label="Bill chính"
              value={formatCurrencyRounded(playerDueAmount(player))}
            />
            {subBillLines.map((line) => (
              <DetailLine
                key={line.id}
                label={line.label}
                value={formatCurrencyRounded(line.amount)}
              />
            ))}
          </div>
          <div className="flex items-baseline justify-between gap-2 bg-sky-700 px-3 py-2 text-white">
            <span className="text-xs font-semibold uppercase tracking-wide">
              TT + Bill sau
            </span>
            <span className="text-base font-bold tabular-nums">
              {formatCurrencyRounded(
                playerDueAmount(player) +
                  subBillLines.reduce((sum, line) => sum + line.amount, 0),
              )}
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function rowMeta(player, subBillLines) {
  return [
    player.is_paid && player.paid_at ? (
      <span
        key="paid-at"
        className="inline-flex items-center gap-1 font-medium tabular-nums text-emerald-700"
      >
        <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
        {formatTimeShort(player.paid_at)}
      </span>
    ) : (
      <span key="ratio">
        Mức tính{" "}
        <b className="font-medium tabular-nums text-slate-700">
          {formatRatio(player.ratio_value)}
        </b>
      </span>
    ),
    player.debt_amount > 0 && (
      <BillPlayerTag key="debt" tone="amber">
        Nợ cũ
      </BillPlayerTag>
    ),
    subBillLines.length > 0 && (
      <BillPlayerTag key="bills" tone="sky">
        {subBillLines.length + 1} bill
      </BillPlayerTag>
    ),
    hasExtraCosts(player) && (
      <BillPlayerTag key="extra">Chi phí thêm</BillPlayerTag>
    ),
  ];
}

function BillTotals({ bill, subBills }) {
  const players = bill.bill_players || [];
  const profit = billProfit(bill);
  const hasSubBillMoney = players.some(
    (p) => playerSubBillLines(p, subBills).length > 0,
  );
  return (
    <div className="rounded-2xl bg-emerald-50/70 px-4 py-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium text-emerald-700">Tổng cộng</span>
        <span className="font-tabular text-xl font-semibold tracking-tight text-emerald-700">
          {formatCurrencyRounded(billCollectedTotal(players))}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">
          Tổng tiền đánh{" "}
          <span className="font-normal text-slate-400">
            (không gồm nợ cũ, menu)
          </span>
        </span>
        <span className="font-tabular text-sm font-semibold text-slate-700">
          {formatCurrencyRounded(billPlayingTotal(players))}
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="text-xs font-medium text-slate-500">
          Tiền lời{" "}
          <span className="font-normal text-slate-400">
            (tiền đánh − tổng tiền bill)
          </span>
        </span>
        <span
          className={`font-tabular text-sm font-semibold ${
            profit < 0 ? "text-rose-600" : "text-emerald-700"
          }`}
        >
          {formatProfit(profit)}
        </span>
      </div>
      {hasSubBillMoney && (
        <div className="mt-1 flex items-baseline justify-between gap-3">
          <span className="text-xs font-medium text-slate-500">
            TT + Bill sau
          </span>
          <span className="font-tabular text-sm font-semibold text-emerald-700">
            {formatCurrencyRounded(
              players.reduce(
                (sum, p) => sum + playerTotalWithSubBills(p, subBills),
                0,
              ),
            )}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Danh sách người chơi của bill cầu trên điện thoại: chip lọc dính dưới thanh trên, hàng M3b
 * (nút "Đã TT" ở mép phải, chạm hàng mở chi tiết), rồi khối tổng cộng như cũ.
 * Bấm "Đã TT" thì hàng xuống nhóm đã trả như hiện nay (quyết định 8).
 *
 * - subBills: bill con của bill chính (tiền "TT + Bill sau"); bill con thì [].
 * - canMark: có quyền bills.mark_payment; không thì hàng chỉ hiện trạng thái.
 * - savingIds: Set user_id đang lưu (nút có vòng quay).
 * - onMarkPayment(userId, isPaid).
 */
export default function BillPlayerList({
  bill,
  subBills = [],
  canMark = false,
  savingIds,
  onMarkPayment,
}) {
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const players = bill.bill_players || [];
  const sorted = sortBillPlayers(players);
  const counts = countBillPlayers(players);
  // Chip về 0 (vd vừa bỏ đánh dấu người đã TT cuối cùng) thì quay về "Tất cả".
  const activeFilter =
    (filter === "paid" && counts.paid === 0) ||
    (filter === "debt" && counts.debt === 0)
      ? "all"
      : filter;
  const visible = filterBillPlayers(sorted, activeFilter);
  const indexOf = new Map(sorted.map((p, i) => [p.id, i + 1]));

  const renderRow = (player) => {
    const subBillLines = playerSubBillLines(player, subBills);
    const multi = subBillLines.length > 0;
    const panelId = `bill-player-${player.id}`;
    const expanded = expandedId === player.id;
    return (
      <BillPlayerRow
        key={player.id}
        index={indexOf.get(player.id)}
        name={player.user?.name}
        meta={rowMeta(player, subBillLines)}
        amount={formatCurrencyRounded(
          multi
            ? playerTotalWithSubBills(player, subBills)
            : playerDueAmount(player),
        )}
        amountNote={multi ? "TT + Bill sau" : undefined}
        paid={Boolean(player.is_paid)}
        saving={savingIds?.has(player.user_id)}
        onTogglePaid={
          canMark
            ? () => onMarkPayment(player.user_id, !player.is_paid)
            : undefined
        }
        highlight={multi}
        expanded={expanded}
        onToggleExpand={() => setExpandedId(expanded ? null : player.id)}
        panelId={panelId}
      >
        <BillPlayerDetail player={player} subBillLines={subBillLines} />
      </BillPlayerRow>
    );
  };

  return (
    <div className="space-y-2">
      <div className="sticky top-[calc(var(--app-bar-h)+env(safe-area-inset-top))] z-10 -mx-4 bg-slate-50/95 py-2 backdrop-blur sm:top-16">
        <div role="group" aria-label="Lọc người chơi" className="chip-row px-4">
          {FILTER_CHIPS.filter(
            (chip) => chip.key !== "debt" || counts.debt > 0,
          ).map((chip) => {
            const pressed = activeFilter === chip.key;
            return (
              <button
                key={chip.key}
                type="button"
                className="chip"
                aria-pressed={pressed}
                aria-label={`${chip.label} ${counts[chip.key]}`}
                disabled={chip.key === "paid" && counts.paid === 0}
                onClick={() => setFilter(chip.key)}
              >
                {chip.label}
                <span
                  className={`font-semibold tabular-nums ${pressed ? "" : "text-slate-500"}`}
                >
                  {counts[chip.key]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {visible.length > 0 ? (
        <ul className="list-card">{visible.map(renderRow)}</ul>
      ) : (
        activeFilter === "unpaid" &&
        counts.all > 0 && (
          <EmptyState
            compact
            icon={CircleCheck}
            title={`Đã thu đủ ${counts.all} người`}
          />
        )
      )}

      <BillTotals bill={bill} subBills={subBills} />
    </div>
  );
}
