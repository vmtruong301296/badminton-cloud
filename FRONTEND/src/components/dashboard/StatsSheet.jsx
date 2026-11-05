import { useMemo, useState } from "react";
import Modal from "../ui/Modal";
import EmptyState from "../ui/EmptyState";
import PeriodStepper from "../ui/PeriodStepper";
import { ChevronDown, ChevronUp } from "../ui/icons";
import MonthlyStatsCharts from "./MonthlyStatsCharts";
import { formatCurrencyRounded, formatNumber } from "../../utils/formatters";
import {
  availableYears,
  formatMonthLabel,
  periodSummary,
  shiftMonthKey,
} from "../../utils/monthlyStats";
import { formatTubes } from "../../utils/shuttleStock";

/** Danh sách người chơi hiện trước bấy nhiêu người, còn lại sau "Xem đủ". */
const TOP_PLAYERS = 10;

const monthKeyOf = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const MODES = [
  { value: "month", label: "Tháng" },
  { value: "year", label: "Năm" },
];

/** Hai ô số đầu sheet (M11): dưới md là nút chọn biểu đồ, từ md chỉ để đọc (hai biểu đồ cạnh nhau). */
function MetricTiles({ summary, metric, onSelect }) {
  const tiles = [
    {
      value: "bills",
      label: "Số bill",
      number: formatNumber(summary.billCount),
      sub: "bill chính",
    },
    {
      value: "shuttles",
      label: "Số cầu (quả)",
      number: formatNumber(summary.totalShuttles),
      sub: formatTubes(summary.totalShuttles),
    },
  ];
  const body = (tile) => (
    <>
      <span className="stat-tile-label">{tile.label}</span>
      <span className="stat-tile-value text-2xl">{tile.number}</span>
      <span className="stat-tile-sub">{tile.sub}</span>
    </>
  );

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:hidden">
        {tiles.map((tile) => {
          const pressed = metric === tile.value;
          return (
            <button
              key={tile.value}
              type="button"
              aria-pressed={pressed}
              onClick={() => onSelect(tile.value)}
              className="stat-tile"
            >
              <span
                aria-hidden="true"
                className={`absolute right-3 top-3.5 h-2 w-2 rounded-full ${pressed ? "bg-emerald-600" : "bg-slate-300"}`}
              />
              {body(tile)}
            </button>
          );
        })}
      </div>
      <div className="hidden grid-cols-2 gap-3 md:grid">
        {tiles.map((tile) => (
          <div key={tile.value} className="stat-tile">
            {body(tile)}
          </div>
        ))}
      </div>
    </>
  );
}

function ShuttleTotals({ summary, periodWord }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 text-base font-semibold text-slate-900">
        Tổng số lượng cầu
      </h3>
      {summary.shuttles.length === 0 ? (
        <div className="text-sm text-slate-500">
          Không có dữ liệu cầu trong {periodWord} này
        </div>
      ) : (
        <div className="space-y-2">
          {summary.shuttles.map((shuttle) => (
            <div
              key={shuttle.name}
              className="flex items-center justify-between gap-3 border-b border-slate-200 py-2 last:border-0"
            >
              <span className="min-w-0 break-words text-sm font-medium text-slate-700">
                {shuttle.name}
              </span>
              <span className="flex-shrink-0 font-tabular text-sm font-semibold text-slate-900">
                {formatNumber(shuttle.totalQuantity)} quả
              </span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t-2 border-slate-300 pt-2">
            <span className="text-sm font-bold text-slate-900">Tổng cộng:</span>
            <span className="font-tabular text-sm font-bold text-slate-900">
              {formatNumber(summary.totalShuttles)} quả
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerTotals({ players, periodWord }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? players : players.slice(0, TOP_PLAYERS);

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 className="mb-3 text-base font-semibold text-slate-900">
        Tổng tiền theo người chơi ({players.length})
      </h3>
      {players.length === 0 ? (
        <div className="text-sm text-slate-500">
          Không có dữ liệu người chơi trong {periodWord} này
        </div>
      ) : (
        <>
          <ol className="divide-y divide-slate-200">
            {shown.map((player, index) => (
              <li
                key={`${player.name}-${index}`}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-start gap-x-2 py-2"
              >
                <span className="font-tabular text-sm text-slate-400">
                  #{index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block break-words text-sm font-medium text-slate-700">
                    {player.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    Số bill: {player.billCount || 0}
                  </span>
                </span>
                <span className="font-tabular text-sm font-semibold text-slate-900">
                  {formatCurrencyRounded(player.totalAmount)}
                </span>
              </li>
            ))}
          </ol>
          {players.length > TOP_PLAYERS && (
            <button
              type="button"
              onClick={() => setShowAll((value) => !value)}
              aria-expanded={showAll}
              className="btn btn-ghost mt-1 w-full text-emerald-700"
            >
              {showAll ? "Thu gọn" : `Xem đủ ${players.length} người`}
              {showAll ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
          <div className="mt-2 flex items-center justify-between border-t-2 border-slate-300 pt-2">
            <span className="text-sm font-bold text-slate-900">Tổng cộng:</span>
            <span className="font-tabular text-sm font-bold text-slate-900">
              {formatCurrencyRounded(
                players.reduce((sum, p) => sum + p.totalAmount, 0),
              )}
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function StatsSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <div className="skeleton h-[88px] rounded-2xl" />
        <div className="skeleton h-[88px] rounded-2xl" />
      </div>
      <div className="skeleton h-64 rounded-xl" />
    </div>
  );
}

/**
 * Sheet "Thống kê": mở ở tháng hiện tại; Tháng / Năm + chọn kỳ ‹ › (M12); hai ô số; biểu đồ 12
 * tháng; tổng cầu; tổng tiền theo người (10 người đầu + "Xem đủ").
 * Màn cha chỉ gắn khi mở (mỗi lần mở bắt đầu lại ở tháng hiện tại).
 *
 * bills: mọi bill, không theo bộ lọc ngày của danh sách. status: "loading" | "error" | "ready".
 */
export default function StatsSheet({ onClose, bills, status, onRetry }) {
  const [now] = useState(() => new Date());
  const currentMonth = monthKeyOf(now);
  const currentYear = now.getFullYear();
  const [mode, setMode] = useState("month");
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [metric, setMetric] = useState("bills");

  const years = useMemo(
    () => availableYears(bills, currentYear),
    [bills, currentYear],
  );
  const summary = useMemo(
    () =>
      periodSummary(bills, mode === "year" ? { mode, year } : { mode, month }),
    [bills, mode, month, year],
  );

  const yearIndex = years.indexOf(year);
  const stepper =
    mode === "year"
      ? {
          label: `Năm ${year}`,
          onPrev: () => setYear(years[yearIndex + 1]),
          onNext: () => setYear(years[yearIndex - 1]),
          prevLabel: "Năm trước",
          nextLabel: "Năm sau",
          prevDisabled: yearIndex === -1 || yearIndex >= years.length - 1,
          nextDisabled: yearIndex <= 0,
        }
      : {
          label: formatMonthLabel(month),
          onPrev: () => setMonth(shiftMonthKey(month, -1)),
          onNext: () => setMonth(shiftMonthKey(month, 1)),
          prevLabel: "Tháng trước",
          nextLabel: "Tháng sau",
          nextDisabled: month >= currentMonth,
        };
  const periodWord = mode === "year" ? "năm" : "tháng";

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Thống kê"
      size="xl"
      initialFocus="panel"
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex rounded-xl bg-slate-100 p-1 sm:inline-flex">
          {MODES.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              aria-pressed={mode === option.value}
              className={`h-10 flex-1 rounded-lg px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 sm:h-9 sm:flex-none ${
                mode === option.value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        <PeriodStepper {...stepper} className="w-full sm:w-auto" />
      </div>

      {status === "loading" ? (
        <StatsSkeleton />
      ) : status === "error" ? (
        <EmptyState
          tone="error"
          compact
          title="Không tải được thống kê"
          description="Kiểm tra mạng rồi thử lại."
          onRetry={onRetry}
        />
      ) : (
        <div className="space-y-4">
          <MetricTiles summary={summary} metric={metric} onSelect={setMetric} />
          <MonthlyStatsCharts
            bills={bills}
            mode={mode}
            month={month}
            year={year}
            metric={metric}
          />
          <ShuttleTotals summary={summary} periodWord={periodWord} />
          <PlayerTotals
            key={`${mode}-${month}-${year}`}
            players={summary.players}
            periodWord={periodWord}
          />
        </div>
      )}
    </Modal>
  );
}
