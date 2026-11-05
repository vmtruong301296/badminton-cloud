import { useState } from "react";
import BillPlayerRow, { BillPlayerTag } from "../bill/BillPlayerRow";
import EmptyState from "../ui/EmptyState";
import { CircleCheck, Clock } from "../ui/icons";
import {
  formatCurrencyRounded,
  formatDateShort,
  formatRatio,
  formatTimeShort,
} from "../../utils/formatters";
import { countBillPlayers, filterBillPlayers } from "../../utils/billPlayers";
import {
  participantBillAmount,
  participantTotalWithDebt,
  sortPartyParticipants,
} from "../../utils/partyBillTotals";

const FILTER_CHIPS = [
  { key: "all", label: "Tất cả" },
  { key: "unpaid", label: "Chưa TT" },
  { key: "paid", label: "Đã TT" },
  { key: "debt", label: "Nợ cũ" },
];

function DetailLine({ label, value, strong = false }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="min-w-0 break-words">{label}</span>
      <span
        className={`flex-none tabular-nums ${strong ? "font-semibold text-slate-900" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Chi tiết mở tại chỗ của một người: các số của bill này, ghi chú, nợ bill tiệc cũ, tổng tiền. */
function ParticipantDetail({ participant }) {
  const debt = Number(participant.debt_amount) || 0;
  return (
    <>
      <div className="space-y-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600">
        <DetailLine
          label="Mức tính"
          value={formatRatio(participant.ratio_value)}
          strong
        />
        <DetailLine
          label="Chia bill"
          value={formatCurrencyRounded(participant.share_amount || 0)}
        />
        <DetailLine
          label="Đã chi"
          value={formatCurrencyRounded(participant.paid_amount || 0)}
        />
        <DetailLine
          label="Tiền thêm"
          value={formatCurrencyRounded(participant.food_amount || 0)}
        />
        <DetailLine
          label="Thành tiền"
          value={formatCurrencyRounded(participantBillAmount(participant))}
          strong
        />
        {participant.note && (
          <div className="border-t border-slate-100 pt-1">
            <span className="font-medium">Ghi chú:</span>{" "}
            <span className="break-words">{participant.note}</span>
          </div>
        )}
      </div>

      {debt > 0 && (
        <div className="space-y-1 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[13px] text-slate-600">
          <DetailLine
            label={<span className="font-medium text-amber-800">Nợ cũ</span>}
            value={
              <b className="font-semibold text-amber-800">
                {formatCurrencyRounded(debt)}
              </b>
            }
          />
          {(participant.debt_details || []).map((item, idx) => (
            <DetailLine
              key={item.bill_id ?? idx}
              label={`${formatDateShort(item.date)}${item.name ? ` · ${item.name}` : ""}`}
              value={formatCurrencyRounded(item.amount)}
            />
          ))}
          <div className="border-t border-amber-200 pt-1">
            <DetailLine
              label={<span className="font-medium">Tổng tiền</span>}
              value={formatCurrencyRounded(
                participantTotalWithDebt(participant),
              )}
              strong
            />
          </div>
        </div>
      )}
    </>
  );
}

function rowMeta(participant) {
  return [
    participant.is_paid && participant.paid_at ? (
      <span
        key="paid-at"
        className="inline-flex items-center gap-1 font-medium tabular-nums text-emerald-700"
      >
        <Clock className="h-3.5 w-3.5" strokeWidth={2.5} />
        {formatTimeShort(participant.paid_at)}
      </span>
    ) : (
      <span key="ratio">
        Mức tính{" "}
        <b className="font-medium tabular-nums text-slate-700">
          {formatRatio(participant.ratio_value)}
        </b>
      </span>
    ),
    Number(participant.debt_amount) > 0 && (
      <BillPlayerTag key="debt" tone="amber">
        Nợ cũ
      </BillPlayerTag>
    ),
    Number(participant.paid_amount) !== 0 && (
      <BillPlayerTag key="paid">Đã chi</BillPlayerTag>
    ),
    Number(participant.food_amount) !== 0 && (
      <BillPlayerTag key="food">Tiền thêm</BillPlayerTag>
    ),
  ];
}

/**
 * Người tham gia bill tiệc trên điện thoại (cùng kiểu màn chi tiết bill cầu): chip lọc dính dưới
 * thanh trên, hàng M3b (nút "Đã TT" mép phải, chạm hàng mở chi tiết tại chỗ), rồi tổng người
 * tham gia như cũ. Số trên hàng = "Tổng tiền" của ảnh xuất (gồm nợ bill tiệc cũ, quyết định 9).
 * Bấm "Đã TT" thì hàng xuống nhóm đã trả như hiện nay (quyết định 8).
 *
 * - canMark: được đánh dấu thanh toán (party_bills.update); không thì hàng chỉ hiện trạng thái.
 * - payingIds: Set id người tham gia đang lưu; onMarkPayment(participant).
 */
export default function PartyParticipantList({
  bill,
  canMark = false,
  payingIds,
  onMarkPayment,
}) {
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  const participants = bill.participants || [];
  const sorted = sortPartyParticipants(participants);
  const counts = countBillPlayers(participants);
  // Chip về 0 (vd vừa bỏ đánh dấu người đã TT cuối cùng) thì quay về "Tất cả".
  const activeFilter =
    (filter === "paid" && counts.paid === 0) ||
    (filter === "debt" && counts.debt === 0)
      ? "all"
      : filter;
  const visible = filterBillPlayers(sorted, activeFilter);
  const indexOf = new Map(sorted.map((p, i) => [p.id, i + 1]));
  const totalBillAmount = participants.reduce(
    (sum, p) => sum + participantBillAmount(p),
    0,
  );

  if (participants.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
        Chưa có người tham gia
      </div>
    );
  }

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
        <ul className="list-card">
          {visible.map((participant) => {
            const panelId = `party-participant-${participant.id}`;
            const expanded = expandedId === participant.id;
            return (
              <BillPlayerRow
                key={participant.id}
                index={indexOf.get(participant.id)}
                name={participant.name}
                meta={rowMeta(participant)}
                amount={formatCurrencyRounded(
                  participantTotalWithDebt(participant),
                )}
                paid={Boolean(participant.is_paid)}
                saving={payingIds?.has(participant.id)}
                onTogglePaid={
                  canMark ? () => onMarkPayment(participant) : undefined
                }
                expanded={expanded}
                onToggleExpand={() =>
                  setExpandedId(expanded ? null : participant.id)
                }
                panelId={panelId}
              >
                <ParticipantDetail participant={participant} />
              </BillPlayerRow>
            );
          })}
        </ul>
      ) : (
        activeFilter === "unpaid" && (
          <EmptyState
            compact
            icon={CircleCheck}
            title={`Đã thu đủ ${counts.all} người`}
          />
        )
      )}

      <div className="rounded-2xl bg-emerald-50/70 px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium text-emerald-700">
            Tổng người tham gia
          </span>
          <span className="font-tabular text-xl font-semibold tracking-tight text-emerald-700">
            {formatCurrencyRounded(totalBillAmount)}
          </span>
        </div>
      </div>
    </div>
  );
}
