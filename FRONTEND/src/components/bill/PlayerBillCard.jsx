import NumberInput from "../common/NumberInput";
import MenuItemPicker from "./MenuItemPicker";
import { formatCurrency, formatRatio } from "../../utils/formatters";

/** Các mức tính hay dùng, bấm một lần là chọn. */
const RATIO_PRESETS = [0.5, 0.6, 0.7, 0.8, 1];

const GENDER_BADGE = {
  female: { label: "Nữ", className: "bg-pink-100 text-pink-700" },
  male: { label: "Nam", className: "bg-sky-100 text-sky-700" },
};

const sameRatio = (a, b) => Math.abs(Number(a) - Number(b)) < 0.0005;

/**
 * Thẻ một người chơi trong form tạo / sửa bill: mức tính (chọn nhanh hoặc
 * nhập tay) và menu nước. `showDefault` bật dòng "Mặc định" — chỉ có nghĩa ở
 * màn tạo, nơi default_ratio_value là mức tính gốc của người chơi.
 */
export default function PlayerBillCard({
  player,
  index,
  menus,
  onUpdate,
  showDefault = false,
}) {
  const ratio = player.ratio_value ?? player.default_ratio_value ?? 1.0;
  const defaultRatio = player.default_ratio_value ?? 1.0;
  const badge = GENDER_BADGE[player.gender];
  const menuTotal = (player.menus || []).reduce(
    (sum, m) => sum + m.subtotal,
    0,
  );
  const inputId = `player-ratio-${index}`;

  const setRatio = (value) => onUpdate({ ...player, ratio_value: value });

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/70 px-3 py-2.5 sm:px-4">
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="min-w-0 truncate text-base font-semibold tracking-tight text-slate-900">
            {player.name}
          </h4>
          {badge && (
            <span
              className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${badge.className}`}
            >
              {badge.label}
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 text-xs">
          <span className="font-tabular rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
            ×{formatRatio(ratio)}
          </span>
          {menuTotal > 0 && (
            <span className="font-tabular rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700">
              {formatCurrency(menuTotal)}
            </span>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 md:grid-cols-5 md:gap-6">
        {/* Mức tính */}
        <section className="md:col-span-2">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <label
              htmlFor={inputId}
              className="text-sm font-medium text-slate-700"
            >
              Mức tính
            </label>
            {showDefault && (
              <button
                type="button"
                onClick={() => setRatio(defaultRatio)}
                className="text-xs text-slate-500 hover:text-emerald-700"
                title="Đặt lại về mức mặc định"
              >
                Mặc định:{" "}
                <span className="font-tabular font-medium text-slate-700">
                  {formatRatio(defaultRatio)}
                </span>
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <div
              role="group"
              aria-label="Chọn nhanh mức tính"
              className="flex flex-wrap gap-1.5"
            >
              {RATIO_PRESETS.map((preset) => {
                const active = sameRatio(ratio, preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRatio(preset)}
                    className={`font-tabular h-10 min-w-[2.75rem] rounded-lg border px-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
                      active
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
                    }`}
                  >
                    {formatRatio(preset)}
                  </button>
                );
              })}
            </div>
            <NumberInput
              id={inputId}
              value={ratio}
              onChange={setRatio}
              min={0}
              step={0.01}
              aria-label="Mức tính tuỳ chỉnh"
              baseClassName="field-input"
              className="!h-10 !w-20 text-center font-tabular"
            />
          </div>
        </section>

        {/* Menu nước */}
        <section className="md:col-span-3">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Menu nước
          </span>
          <MenuItemPicker player={player} onUpdate={onUpdate} menus={menus} />
        </section>
      </div>
    </article>
  );
}
