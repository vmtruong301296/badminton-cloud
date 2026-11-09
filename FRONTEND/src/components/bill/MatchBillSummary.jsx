import { formatCurrencyRounded } from "../../utils/formatters";

/**
 * Tóm tắt bill chia theo trận (xem trước). `variant`: "card" (cột phải desktop) | "sheet" (thân
 * sheet Tóm tắt Bill trên điện thoại, không khung). Cả hai đều liệt kê tiền từng người vì form
 * chia theo trận không có hàng người chơi riêng.
 *
 * @param {{
 *   preview: ReturnType<typeof import("../../utils/matchBill").calculateMatchPreview>,
 *   candidates: { user_id: number, name: string }[],
 *   variant?: "card" | "sheet",
 * }} props
 */
export default function MatchBillSummary({
  preview,
  candidates,
  variant = "card",
}) {
  const isSheet = variant === "sheet";
  const nameOf = (userId) =>
    candidates.find((c) => c.user_id === userId)?.name ?? `#${userId}`;

  return (
    <div className={isSheet ? undefined : "card"}>
      {!isSheet && (
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Tóm tắt Bill
        </h2>
      )}

      <div className="space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">
            Tổng tiền sân ({preview.matches.length} trận):
          </span>
          <span className="font-tabular font-medium text-slate-900">
            {formatCurrencyRounded(preview.court_total)}
          </span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-slate-500">Tổng tiền cầu:</span>
          <span className="font-tabular font-medium text-slate-900">
            {formatCurrencyRounded(preview.total_shuttle_price)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-50 px-3 py-2.5">
          <span className="font-semibold text-emerald-800">Tổng tiền:</span>
          <span className="font-tabular text-lg font-semibold tracking-tight text-emerald-700">
            {formatCurrencyRounded(preview.total_amount)}
          </span>
        </div>

        {preview.players.length > 0 && (
          <div className="border-t border-slate-100 pt-4">
            <div className="mb-2 text-slate-500">Tiền từng người:</div>
            <ul className="space-y-1.5 text-slate-700">
              {preview.players.map((player) => (
                <li
                  key={player.user_id}
                  className="flex items-baseline justify-between gap-3"
                >
                  <span className="min-w-0 break-words">
                    {nameOf(player.user_id)}{" "}
                    <span className="text-xs text-slate-500">
                      · {player.match_count} trận
                    </span>
                  </span>
                  <span className="font-tabular flex-shrink-0 font-semibold text-slate-900">
                    {formatCurrencyRounded(player.share_amount)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
