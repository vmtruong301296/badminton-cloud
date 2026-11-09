import { Fragment } from "react";
import { formatCurrency } from "../../utils/formatters";
import { matchDisplayLines } from "../../utils/matchBill";

/**
 * Người đánh của trận theo bên: "A + B vs C + D" (đánh đơn "A vs B").
 *
 * @param {{ teams: string[][] }} props
 */
export function MatchTeams({ teams }) {
  return teams.map((names, index) => (
    <Fragment key={index}>
      {index > 0 && (
        <span className="whitespace-pre text-xs font-semibold text-slate-400">
          {" vs "}
        </span>
      )}
      <span>{names.join(" + ")}</span>
    </Fragment>
  ));
}

/**
 * Các trận của bill chia theo trận (màn chi tiết): Cặp A vs Cặp B, cầu, tiền mỗi người của trận.
 * `variant`: "section" (thẻ riêng của màn chi tiết bill) | "plain" (khối trong BillContent).
 *
 * @param {{ bill: object, variant?: "section" | "plain", className?: string }} props
 */
export default function BillMatchesCard({
  bill,
  variant = "section",
  className = "",
}) {
  const lines = matchDisplayLines(bill);
  if (lines.length === 0) return null;

  const isSection = variant === "section";
  const title = (
    <>
      Các trận{" "}
      <span className="font-tabular text-slate-500">({lines.length})</span>
    </>
  );

  const list = (
    <ol className="divide-y divide-slate-100">
      {lines.map((line) => (
        <li
          key={line.id}
          className={
            isSection ? "px-4 py-3 sm:px-5" : "py-2 first:pt-0 last:pb-0"
          }
        >
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-semibold text-slate-900">
              Trận {line.position}{" "}
              <span className="text-xs font-medium text-slate-500">
                · {line.kind}
              </span>
            </span>
            <span className="font-tabular flex-shrink-0 text-sm font-semibold text-slate-900">
              {formatCurrency(line.per_player)}
              <span className="text-xs font-normal text-slate-500">/người</span>
            </span>
          </div>
          <div className="mt-0.5 break-words text-sm text-slate-700">
            <MatchTeams teams={line.teams} />
          </div>
          <div className="font-tabular mt-0.5 text-xs text-slate-500">
            {line.shuttle_text} = {formatCurrency(line.subtotal)}
          </div>
        </li>
      ))}
    </ol>
  );

  if (isSection) {
    return (
      <section
        className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card ${className}`}
      >
        <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        </div>
        {list}
      </section>
    );
  }

  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-3 sm:p-4 ${className}`}
    >
      <h4 className="mb-2 text-sm font-semibold text-slate-900">{title}</h4>
      {list}
    </div>
  );
}
