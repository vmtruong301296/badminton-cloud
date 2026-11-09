import { useId } from "react";
import CurrencyInput from "../common/CurrencyInput";
import { formatCurrency, shuttleUnitPrice } from "../../utils/formatters";
import {
  MATCH_SIZES,
  setMatchSize,
  toggleMatchPlayer,
} from "../../utils/matchBill";
import { Check, CircleAlert, X } from "../ui/icons";

const CHIP =
  "inline-flex h-11 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 sm:h-9";

function FieldError({ id, message }) {
  return (
    <p id={id} className="field-error mt-1.5">
      <CircleAlert />
      {message}
    </p>
  );
}

const money = (value) => formatCurrency(Math.round(value));

/**
 * Một trận của bill chia theo trận: đôi / đơn, chọn người (từ danh sách bill chính), loại cầu
 * + số quả, dòng phụ tiền mỗi người của trận. `data-field` của từng ô khớp matchFormErrorList.
 *
 * @param {{
 *   index: number,
 *   match: { size: number, player_ids: number[], shuttle_type_id: number|null, quantity: number },
 *   candidates: { user_id: number, name: string }[],
 *   shuttleTypes: object[],
 *   typesLoading?: boolean,
 *   line?: { subtotal: number, court_share: number, shuttle_share: number, per_player: number },
 *   errors?: { players?: string, shuttle?: string, quantity?: string },
 *   onChange: (match: object) => void,
 *   onRemove: () => void,
 * }} props
 */
export default function MatchCard({
  index,
  match,
  candidates,
  shuttleTypes,
  typesLoading = false,
  line,
  errors = {},
  onChange,
  onRemove,
}) {
  const uid = useId();
  const number = index + 1;
  const full = match.player_ids.length >= match.size;
  const ids = {
    players: `${uid}-players-err`,
    shuttle: `${uid}-shuttle-err`,
    quantity: `${uid}-qty-err`,
  };

  return (
    <div className="rounded-xl border border-slate-200 p-3 sm:p-4">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-900">Trận {number}</h3>
        <div
          role="radiogroup"
          aria-label={`Kiểu trận ${number}`}
          className="ml-auto inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5"
        >
          {MATCH_SIZES.map(({ size, label }) => (
            <button
              key={size}
              type="button"
              role="radio"
              aria-checked={match.size === size}
              onClick={() => onChange(setMatchSize(match, size))}
              className={`inline-flex h-10 items-center rounded-md px-3 text-sm font-medium transition sm:h-8 ${
                match.size === size
                  ? "bg-white text-emerald-700 shadow-sm ring-1 ring-emerald-600/30"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {label} · {size}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Xóa trận ${number}`}
          className="btn btn-danger-soft btn-icon"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <span id={`${uid}-players-label`} className="field-label !mb-0">
            Người chơi
          </span>
          <span
            className={`font-tabular text-xs font-medium ${full ? "text-emerald-700" : "text-slate-500"}`}
          >
            {match.player_ids.length}/{match.size}
          </span>
        </div>
        <div
          role="group"
          aria-labelledby={`${uid}-players-label`}
          aria-describedby={errors.players ? ids.players : undefined}
          data-field={`match-${index}-players`}
          tabIndex={-1}
          className="flex flex-wrap gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/30"
        >
          {candidates.map((player) => {
            const selected = match.player_ids.includes(player.user_id);
            return (
              <button
                key={player.user_id}
                type="button"
                aria-pressed={selected}
                disabled={!selected && full}
                onClick={() =>
                  onChange(toggleMatchPlayer(match, player.user_id))
                }
                className={`${CHIP} ${
                  selected
                    ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300"
                }`}
              >
                {selected && (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                )}
                {player.name}
              </button>
            );
          })}
          {candidates.length === 0 && (
            <p className="text-sm text-slate-500">Chưa có người để chọn.</p>
          )}
        </div>
        {errors.players && (
          <FieldError id={ids.players} message={errors.players} />
        )}
      </div>

      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_5.5rem] items-end gap-x-2">
        <div>
          <label htmlFor={`${uid}-type`} className="field-label">
            Loại cầu
          </label>
          <select
            id={`${uid}-type`}
            value={match.shuttle_type_id || ""}
            disabled={typesLoading && shuttleTypes.length === 0}
            onChange={(e) =>
              onChange({
                ...match,
                shuttle_type_id: Number(e.target.value) || null,
              })
            }
            data-field={`match-${index}-shuttle`}
            aria-invalid={errors.shuttle ? true : undefined}
            aria-describedby={errors.shuttle ? ids.shuttle : undefined}
            className="field-input"
          >
            <option value="" disabled>
              {typesLoading ? "Đang tải loại cầu…" : "Chọn loại cầu"}
            </option>
            {shuttleTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name} — {formatCurrency(shuttleUnitPrice(type))}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-qty`} className="field-label">
            Số quả
          </label>
          <CurrencyInput
            id={`${uid}-qty`}
            value={match.quantity}
            onChange={(quantity) => onChange({ ...match, quantity })}
            allowNegative={false}
            selectOnFocus
            enterKeyHint="next"
            data-next="money"
            data-field={`match-${index}-quantity`}
            aria-invalid={errors.quantity ? true : undefined}
            aria-describedby={errors.quantity ? ids.quantity : undefined}
            baseClassName="field-input"
            className="text-right"
          />
        </div>
      </div>
      {errors.shuttle && (
        <FieldError id={ids.shuttle} message={errors.shuttle} />
      )}
      {errors.quantity && (
        <FieldError id={ids.quantity} message={errors.quantity} />
      )}

      {line && (
        <p className="mt-2 text-xs leading-5 text-slate-500">
          Cầu <span className="font-tabular">{money(line.subtotal)}</span> · Mỗi
          người{" "}
          <span className="font-tabular font-semibold text-slate-800">
            {money(line.per_player)}
          </span>{" "}
          <span className="whitespace-nowrap">
            (sân <span className="font-tabular">{money(line.court_share)}</span>{" "}
            + cầu{" "}
            <span className="font-tabular">{money(line.shuttle_share)}</span>)
          </span>
        </p>
      )}
    </div>
  );
}
