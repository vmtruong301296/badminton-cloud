import { useMemo } from "react";
import ColumnChart from "../ui/ColumnChart";
import { monthlyBillStats } from "../../utils/monthlyStats";

/**
 * Biểu đồ số bill và số cầu theo tháng trong modal Thống kê.
 * - mode "year": tháng 1 -> 12 của `year`, mọi cột cùng màu.
 * - mode "month": 12 tháng kết thúc ở `month` ("YYYY-MM"), tháng đó được nhấn.
 * Hai đại lượng khác thang đo nên vẽ hai biểu đồ riêng, không chung trục.
 */
export default function MonthlyStatsCharts({ bills, mode, month, year }) {
  const [endYear, endMonth] =
    mode === "year" ? [year, 12] : month.split("-").map(Number);
  const highlightKey = mode === "year" ? null : month;

  const months = useMemo(
    () => monthlyBillStats(bills, endYear, endMonth),
    [bills, endYear, endMonth],
  );

  const toPoints = (field) =>
    months.map((m) => ({
      key: m.key,
      label: `T${m.month}`,
      fullLabel: `Tháng ${m.month}/${m.year}`,
      value: m[field],
    }));

  const first = months[0];
  const last = months[months.length - 1];
  const periodLabel =
    mode === "year"
      ? `Năm ${year}`
      : `${first.month}/${first.year} – ${last.month}/${last.year}`;
  const totalBills = months.reduce((sum, m) => sum + m.bills, 0);
  const totalShuttles = months.reduce((sum, m) => sum + m.shuttles, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className="text-base font-semibold text-slate-900">Theo tháng</h3>
        <span className="text-xs text-slate-500">{periodLabel}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <figure className="rounded-lg bg-white p-3">
          <figcaption className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">Số bill</span>
            <span className="font-tabular text-xs text-slate-500">
              Tổng {totalBills} bill
            </span>
          </figcaption>
          <ColumnChart
            data={toPoints("bills")}
            unit="bill"
            highlightKey={highlightKey}
          />
        </figure>

        <figure className="rounded-lg bg-white p-3">
          <figcaption className="mb-1 flex items-baseline justify-between gap-2">
            <span className="text-sm font-medium text-slate-700">
              Số cầu (quả)
            </span>
            <span className="font-tabular text-xs text-slate-500">
              Tổng {totalShuttles} quả
            </span>
          </figcaption>
          <ColumnChart
            data={toPoints("shuttles")}
            unit="quả"
            highlightKey={highlightKey}
          />
        </figure>
      </div>

      <details className="mt-3 group">
        <summary className="cursor-pointer select-none text-sm font-medium text-emerald-700 hover:text-emerald-800">
          Xem dạng bảng
        </summary>
        <div className="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Tháng</th>
                <th className="px-3 py-2 text-right font-medium">Số bill</th>
                <th className="px-3 py-2 text-right font-medium">Số cầu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...months].reverse().map((m) => (
                <tr
                  key={m.key}
                  className={m.key === highlightKey ? "bg-emerald-50/60" : ""}
                >
                  <td className="px-3 py-1.5 text-slate-700">
                    {m.month}/{m.year}
                  </td>
                  <td className="font-tabular px-3 py-1.5 text-right text-slate-900">
                    {m.bills}
                  </td>
                  <td className="font-tabular px-3 py-1.5 text-right text-slate-900">
                    {m.shuttles}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
