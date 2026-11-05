import CurrencyInput from "../common/CurrencyInput";
import NumberInput from "../common/NumberInput";
import MenuItemPicker from "./MenuItemPicker";
import QuickAddMenu from "./QuickAddMenu";
import { ChevronDown, Trash2 } from "../ui/icons";
import {
  formatCurrency,
  formatCurrencyRounded,
  formatRatio,
} from "../../utils/formatters";
import { playerExtraTotal } from "../../utils/menus";

/** Các mức tính hay dùng, bấm một lần là chọn. */
const RATIO_PRESETS = [0.4, 0.5, 0.6, 0.7, 0.8, 1];

/** Nền thanh tiêu đề theo giới tính để lướt nhanh phân biệt nam / nữ; nhãn
 *  Nam / Nữ vẫn giữ để không chỉ dựa vào màu. */
const GENDER_STYLE = {
  female: {
    label: "Nữ",
    badge: "bg-pink-100 text-pink-700",
    header: "border-pink-100 bg-pink-50",
    order: "text-pink-700",
    row: "bg-pink-50 aria-expanded:bg-pink-50",
  },
  male: {
    label: "Nam",
    badge: "bg-sky-100 text-sky-700",
    header: "border-sky-100 bg-sky-50",
    order: "text-sky-700",
    row: "bg-sky-50 aria-expanded:bg-sky-50",
  },
};

const NEUTRAL_STYLE = {
  header: "border-slate-100 bg-slate-50/70",
  order: "text-slate-500",
  row: "",
};

const sameRatio = (a, b) => Math.abs(Number(a) - Number(b)) < 0.0005;

/**
 * Thẻ một người chơi trong form tạo / sửa bill: mức tính (chọn nhanh hoặc
 * nhập tay), menu nước và tiền cộng thêm kèm nội dung (vd "Tiền cộng thêm 10k
 * ở trận trước"). Menu nước và cộng thêm gộp lại thành chi phí thêm của người
 * đó. `showDefault` bật dòng "Mặc định" — chỉ có nghĩa ở màn tạo, nơi
 * default_ratio_value là mức tính gốc của người chơi.
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
  const genderStyle = GENDER_STYLE[player.gender];
  const { header: headerClass, order: orderClass } =
    genderStyle ?? NEUTRAL_STYLE;
  const extraTotal = playerExtraTotal(player);
  const inputId = `player-ratio-${index}`;
  const extraNoteId = `player-extra-note-${index}`;
  const extraAmountId = `player-extra-amount-${index}`;

  const setRatio = (value) => onUpdate({ ...player, ratio_value: value });

  return (
    <article className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <header
        className={`flex items-center justify-between gap-3 border-b px-3 py-2.5 sm:px-4 ${headerClass}`}
      >
        <div className="flex min-w-0 items-center gap-2">
          <h4 className="min-w-0 truncate text-base font-semibold tracking-tight text-slate-900">
            <span className={`font-tabular ${orderClass}`}>#{index + 1}</span>{" "}
            {player.name}
          </h4>
          {genderStyle && (
            <span
              className={`flex-shrink-0 rounded-full px-1.5 py-0.5 text-xs font-medium ${genderStyle.badge}`}
            >
              {genderStyle.label}
            </span>
          )}
        </div>
        <div className="flex flex-shrink-0 items-center gap-1.5 text-xs">
          <span className="font-tabular rounded-md bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
            ×{formatRatio(ratio)}
          </span>
          {extraTotal !== 0 && (
            <span className="font-tabular rounded-md bg-amber-50 px-2 py-1 font-semibold text-amber-700">
              {formatCurrency(extraTotal)}
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
              className="grid w-full max-w-xs grid-cols-6 gap-1.5"
            >
              {RATIO_PRESETS.map((preset) => {
                const active = sameRatio(ratio, preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRatio(preset)}
                    className={`font-tabular h-10 rounded-lg border px-1 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
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

        {/* Cộng thêm: số tiền + nội dung, nằm trong chi phí thêm cùng menu nước */}
        <section className="md:col-span-5">
          <label
            htmlFor={extraAmountId}
            className="mb-2 block text-sm font-medium text-slate-700"
          >
            Cộng thêm
          </label>
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 sm:col-span-8">
              <input
                id={extraNoteId}
                type="text"
                value={player.extra_note || ""}
                onChange={(e) =>
                  onUpdate({ ...player, extra_note: e.target.value })
                }
                maxLength={255}
                placeholder="Nội dung, vd: Tiền cộng thêm 10k ở trận trước"
                aria-label="Nội dung cộng thêm"
                enterKeyHint="next"
                data-next={`extra-${index}`}
                className="field-input"
              />
            </div>
            <div className="col-span-12 sm:col-span-4">
              <CurrencyInput
                id={extraAmountId}
                value={player.extra_amount ?? 0}
                onChange={(value) =>
                  onUpdate({ ...player, extra_amount: value })
                }
                aria-label="Số tiền cộng thêm"
                data-next={`extra-${index}`}
                baseClassName="field-input"
                className="text-right font-tabular"
              />
            </div>
          </div>
        </section>
      </div>
    </article>
  );
}

/** Nhãn nhỏ dưới tên ở hàng người chơi (điện thoại). */
function RowTags({ player, ratio, extraTotal, genderStyle }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
      {genderStyle && (
        <span
          className={`rounded-full px-1.5 py-0.5 font-medium ${genderStyle.badge}`}
        >
          {genderStyle.label}
        </span>
      )}
      <span className="font-tabular rounded-md bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700">
        ×{formatRatio(ratio)}
      </span>
      {extraTotal !== 0 && (
        <span className="font-tabular rounded-md bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-700">
          {formatCurrency(extraTotal)}
        </span>
      )}
      {player.debt_amount > 0 && (
        <span className="font-tabular font-medium text-rose-600">
          Nợ: {formatCurrency(player.debt_amount)}
        </span>
      )}
      {player.is_paid && <span className="badge badge-emerald">Đã TT</span>}
    </div>
  );
}

/**
 * Hàng một người chơi trên điện thoại (M3c, mở tại chỗ): #STT màu nam / nữ, nhãn Nam / Nữ,
 * ×mức tính, tiền cộng thêm, Nợ, "Đã TT" (màn sửa) và số tiền xem trước làm tròn nghìn.
 * Chạm hàng mở phần sửa: mức tính (6 nút + ô mức khác + "Mặc định"), cộng thêm, menu nước,
 * "Bỏ khỏi bill" / "Xong". Màn giữ hàng nào đang mở (mỗi lúc một hàng).
 *
 * `amount`: tổng xem trước của người này (preview.players[i].total_amount).
 * `allMenus` + `onMenuAdded`: cho "Thêm nhanh menu" trong phần mở.
 */
export function PlayerBillRow({
  player,
  index,
  menus,
  allMenus,
  onMenuAdded,
  onUpdate,
  onRemove,
  amount,
  expanded,
  onToggle,
  showDefault = false,
}) {
  const ratio = player.ratio_value ?? player.default_ratio_value ?? 1.0;
  const defaultRatio = player.default_ratio_value ?? 1.0;
  const genderStyle = GENDER_STYLE[player.gender];
  const { order: orderClass, row: rowClass } = genderStyle ?? NEUTRAL_STYLE;
  const extraTotal = playerExtraTotal(player);
  const panelId = `player-row-panel-${index}`;
  const ratioId = `player-row-ratio-${index}`;
  const extraNoteId = `player-row-extra-note-${index}`;
  const extraAmountId = `player-row-extra-amount-${index}`;

  const setRatio = (value) => onUpdate({ ...player, ratio_value: value });

  return (
    <li>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={onToggle}
        className={`list-row items-start ${rowClass}`}
      >
        <div className="list-row-text">
          <p className="break-words text-[15px] font-semibold leading-5 text-slate-900">
            <span className={`font-tabular ${orderClass}`}>#{index + 1}</span>{" "}
            {player.name}
          </p>
          <RowTags
            player={player}
            ratio={ratio}
            extraTotal={extraTotal}
            genderStyle={genderStyle}
          />
        </div>
        <span className="amount text-slate-900">
          {formatCurrencyRounded(amount || 0)}
        </span>
        <ChevronDown className="list-row-chevron mt-[3px]" />
      </button>

      {expanded && (
        <div id={panelId} className="list-row-panel space-y-4 pb-4">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label
                htmlFor={ratioId}
                className="text-sm font-medium text-slate-700"
              >
                Mức tính
              </label>
              <div className="flex items-center gap-2">
                {showDefault && (
                  <button
                    type="button"
                    onClick={() => setRatio(defaultRatio)}
                    className="h-11 rounded-lg bg-slate-200/60 px-3 text-sm text-slate-600 active:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                  >
                    Mặc định:{" "}
                    <span className="font-tabular font-semibold text-slate-800">
                      {formatRatio(defaultRatio)}
                    </span>
                  </button>
                )}
                <NumberInput
                  id={ratioId}
                  value={ratio}
                  onChange={setRatio}
                  min={0}
                  step={0.01}
                  selectOnFocus
                  enterKeyHint="done"
                  data-next={`ratio-${index}`}
                  baseClassName="field-input"
                  className="!w-20 text-center font-tabular"
                />
              </div>
            </div>
            <div
              role="group"
              aria-label="Chọn nhanh mức tính"
              className="grid grid-cols-6 gap-1.5"
            >
              {RATIO_PRESETS.map((preset) => {
                const active = sameRatio(ratio, preset);
                return (
                  <button
                    key={preset}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setRatio(preset)}
                    className={`font-tabular h-11 rounded-lg border px-1 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
                      active
                        ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 active:bg-emerald-50"
                    }`}
                  >
                    {formatRatio(preset)}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <label
              htmlFor={extraAmountId}
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Cộng thêm
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-2">
              <input
                id={extraNoteId}
                type="text"
                value={player.extra_note || ""}
                onChange={(e) =>
                  onUpdate({ ...player, extra_note: e.target.value })
                }
                maxLength={255}
                placeholder="Nội dung, vd: Tiền cộng thêm 10k ở trận trước"
                aria-label="Nội dung cộng thêm"
                enterKeyHint="next"
                data-next={`extra-row-${index}`}
                className="field-input"
              />
              <CurrencyInput
                id={extraAmountId}
                value={player.extra_amount ?? 0}
                onChange={(value) =>
                  onUpdate({ ...player, extra_amount: value })
                }
                aria-label="Số tiền cộng thêm"
                selectOnFocus
                enterKeyHint="done"
                data-next={`extra-row-${index}`}
                baseClassName="field-input"
                className="text-right font-tabular"
              />
            </div>
          </section>

          <section>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-700">
                Menu nước
              </span>
              <QuickAddMenu
                variant="link"
                menus={allMenus}
                onCreated={onMenuAdded}
              />
            </div>
            <MenuItemPicker player={player} onUpdate={onUpdate} menus={menus} />
          </section>

          <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <button
              type="button"
              onClick={onRemove}
              className="btn btn-danger-ghost -ml-3"
            >
              <Trash2 className="h-4 w-4" />
              Bỏ khỏi bill
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="btn btn-secondary min-w-[5.5rem]"
            >
              Xong
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
