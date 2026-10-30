import { useState } from "react";

/** Làm tròn lên số "đẹp" 1 / 2 / 5 x 10^n để vạch trục dễ đọc. */
const niceCeil = (value) => {
  if (value <= 0) return 1;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((s) => s * power >= value);
  return step * power;
};

const formatTick = (value) =>
  value >= 1000 ? `${Number((value / 1000).toFixed(1))}K` : String(value);

/**
 * Biểu đồ cột một chuỗi số liệu, vẽ bằng HTML (không thư viện).
 *
 * - `data`: [{ key, label, fullLabel, value }] — label hiện dưới cột, fullLabel
 *   hiện trong tooltip.
 * - `highlightKey`: cột được nhấn (xanh), các cột khác xám. Bỏ trống thì mọi cột
 *   cùng màu xanh.
 * - Chỉ ghi số trên cột nhấn và cột cao nhất; số các cột khác xem qua tooltip
 *   (rê chuột / chạm / Tab) hoặc bảng số liệu đi kèm.
 */
export default function ColumnChart({ data, unit, highlightKey = null }) {
  const [activeKey, setActiveKey] = useState(null);
  const maxValue = Math.max(0, ...data.map((d) => d.value));
  const axisMax = niceCeil(maxValue);
  const peakKey =
    maxValue > 0 ? data.find((d) => d.value === maxValue).key : null;
  const lastIndex = data.length - 1;

  return (
    <div className="relative pl-8">
      {/* Vạch trục: 0, giữa, đỉnh */}
      <div className="pointer-events-none absolute inset-y-0 left-0 right-0 pt-5 pb-5">
        <div className="relative h-full">
          {[1, 0.5, 0].map((ratio) => (
            <div
              key={ratio}
              className="absolute left-0 right-0 flex items-center"
              style={{ bottom: `${ratio * 100}%` }}
            >
              <span className="font-tabular w-7 -translate-y-px pr-1 text-right text-[10px] leading-none text-slate-400">
                {formatTick(axisMax * ratio)}
              </span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex h-44 items-stretch gap-0.5 pt-5">
        {data.map((d, index) => {
          const emphasized = highlightKey === null || d.key === highlightKey;
          const active = activeKey === d.key;
          const showValue = d.key === highlightKey || d.key === peakKey;
          const tooltipAlign =
            index < 2
              ? "left-0"
              : index > lastIndex - 2
                ? "right-0"
                : "left-1/2 -translate-x-1/2";

          return (
            <button
              key={d.key}
              type="button"
              aria-label={`${d.fullLabel}: ${d.value} ${unit}`}
              onPointerEnter={() => setActiveKey(d.key)}
              onPointerLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(d.key)}
              onBlur={() => setActiveKey(null)}
              onClick={() => setActiveKey(d.key)}
              className="relative flex min-w-0 flex-1 flex-col items-center justify-end rounded-sm pb-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
            >
              <span className="relative flex h-full w-full items-end justify-center">
                <span
                  className={`relative w-full max-w-[24px] rounded-t transition ${
                    emphasized ? "bg-emerald-600" : "bg-slate-400"
                  } ${active ? "brightness-110" : ""}`}
                  style={{ height: `${(d.value / axisMax) * 100}%` }}
                >
                  {showValue && d.value > 0 && (
                    <span className="font-tabular absolute bottom-full left-1/2 mb-0.5 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold leading-none text-slate-700">
                      {d.value}
                    </span>
                  )}
                </span>
              </span>
              <span
                className={`absolute bottom-0 text-[10px] leading-5 ${
                  d.key === highlightKey
                    ? "font-semibold text-slate-900"
                    : "text-slate-500"
                }`}
              >
                {d.label}
              </span>

              {active && (
                <span
                  role="tooltip"
                  className={`pointer-events-none absolute top-0 z-10 -translate-y-full whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1.5 text-left shadow-lg ${tooltipAlign}`}
                >
                  <span className="font-tabular block text-sm font-semibold text-white">
                    {d.value} {unit}
                  </span>
                  <span className="block text-[11px] text-slate-300">
                    {d.fullLabel}
                  </span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
