import { useId } from "react";
import CurrencyInput from "../common/CurrencyInput";
import { formatCurrency, shuttleUnitPrice } from "../../utils/formatters";
import {
  MATCH_SIZES,
  addMatchShuttle,
  setMatchSize,
  teamCapacity,
  teamLabel,
  toggleTeamPlayer,
} from "../../utils/matchBill";
import { CircleAlert, Plus, Users, X } from "../ui/icons";

function FieldError({ id, message }) {
  return (
    <p id={id} className="field-error mt-1.5">
      <CircleAlert />
      {message}
    </p>
  );
}

const money = (value) => formatCurrency(Math.round(value));

/** Một bên của trận (Cặp A / Cặp B): người đã chọn (chạm × để bỏ) + nút mở sheet chọn người. */
function TeamBox({
  uid,
  index,
  team,
  match,
  nameOf,
  error,
  onChange,
  onOpenPicker,
}) {
  const number = index + 1;
  const label = teamLabel(match.size, team);
  const capacity = teamCapacity(match);
  const ids = match.teams[team];
  const full = ids.length >= capacity;
  const labelId = `${uid}-team-${team}-label`;
  const errorId = `${uid}-team-${team}-err`;
  const pickLabel =
    ids.length === 0
      ? `Chọn ${capacity} người`
      : full
        ? "Đổi người"
        : "Chọn thêm";

  return (
    <div
      className={`min-w-0 rounded-lg border bg-slate-50/60 p-2.5 ${error ? "border-rose-300" : "border-slate-200"}`}
    >
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span id={labelId} className="text-sm font-semibold text-slate-800">
          {label}
        </span>
        <span
          className={`font-tabular text-xs font-medium ${full ? "text-emerald-700" : "text-slate-500"}`}
        >
          {ids.length}/{capacity}
        </span>
      </div>
      <ul aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {ids.map((userId) => (
          <li
            key={userId}
            className="inline-flex h-11 max-w-full items-center rounded-lg border border-emerald-600 bg-emerald-50 pl-3 text-sm font-medium text-emerald-800 sm:h-9"
          >
            <span className="truncate">{nameOf(userId)}</span>
            <button
              type="button"
              onClick={() => onChange(toggleTeamPlayer(match, team, userId))}
              aria-label={`Bỏ ${nameOf(userId)} khỏi ${label} trận ${number}`}
              className="ml-0.5 flex h-11 w-9 flex-none items-center justify-center rounded-r-lg text-emerald-700 hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40 sm:h-9 sm:w-8"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => onOpenPicker(team)}
            data-field={`match-${index}-team-${team}`}
            aria-label={`${pickLabel} cho ${label} trận ${number}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            className={`inline-flex h-11 items-center gap-1.5 rounded-lg border border-dashed bg-white px-3 text-sm font-semibold transition sm:h-9 ${
              error
                ? "border-rose-400 text-rose-700 hover:bg-rose-50"
                : "border-emerald-400 text-emerald-700 hover:bg-emerald-50"
            }`}
          >
            <Users className="h-4 w-4" />
            {pickLabel}
          </button>
        </li>
      </ul>
      {error && <FieldError id={errorId} message={error} />}
    </div>
  );
}

/** Người đánh của trận theo bên: Cặp A vs Cặp B (điện thoại xếp chồng, màn rộng nằm ngang). */
function MatchTeamsField({ teamErrors = {}, ...props }) {
  return (
    <div className="mt-3">
      <span className="field-label">Người chơi</span>
      <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:gap-2">
        <TeamBox team={0} error={teamErrors[0]} {...props} />
        <span
          aria-hidden="true"
          className="self-center text-center text-xs font-semibold text-slate-400"
        >
          vs
        </span>
        <TeamBox team={1} error={teamErrors[1]} {...props} />
      </div>
    </div>
  );
}

/** Các loại cầu của trận: mỗi dòng một loại + số quả; một loại chỉ chọn được ở một dòng. */
function MatchShuttleLines({
  uid,
  index,
  match,
  shuttleTypes,
  typesLoading,
  errors = {},
  onChange,
}) {
  const number = index + 1;
  const removable = match.shuttles.length > 1;
  const canAdd =
    shuttleTypes.length > 0 &&
    match.shuttles.every((line) => line.shuttle_type_id) &&
    shuttleTypes.some(
      (t) => !match.shuttles.some((line) => line.shuttle_type_id === t.id),
    );
  const cols = removable
    ? "grid-cols-[minmax(0,1fr)_4rem_2.75rem]"
    : "grid-cols-[minmax(0,1fr)_4rem]";

  const updateLine = (key, patch) =>
    onChange({
      ...match,
      shuttles: match.shuttles.map((line) =>
        line.key === key ? { ...line, ...patch } : line,
      ),
    });
  const removeLine = (key) =>
    onChange({
      ...match,
      shuttles: match.shuttles.filter((line) => line.key !== key),
    });

  return (
    <div className="mt-3">
      <div
        aria-hidden="true"
        className={`mb-1.5 grid ${cols} gap-x-2 text-sm font-medium text-slate-700`}
      >
        <span>Loại cầu</span>
        <span>Số quả</span>
      </div>
      <ul className="space-y-2">
        {match.shuttles.map((line, lineIndex) => {
          const lineErrors = errors.lines?.[lineIndex] ?? {};
          const errorId = `${uid}-line-${line.key}-err`;
          const lineError = lineErrors.shuttle ?? lineErrors.quantity;
          const takenIds = new Set(
            match.shuttles
              .filter((other) => other.key !== line.key)
              .map((other) => other.shuttle_type_id),
          );
          return (
            <li key={line.key}>
              <div className={`grid ${cols} items-center gap-x-2`}>
                <select
                  value={line.shuttle_type_id || ""}
                  disabled={typesLoading && shuttleTypes.length === 0}
                  onChange={(e) =>
                    updateLine(line.key, {
                      shuttle_type_id: Number(e.target.value) || null,
                    })
                  }
                  aria-label={`Loại cầu ${lineIndex + 1} của trận ${number}`}
                  data-field={`match-${index}-shuttle-${lineIndex}`}
                  aria-invalid={lineErrors.shuttle ? true : undefined}
                  aria-describedby={lineErrors.shuttle ? errorId : undefined}
                  className="field-input"
                >
                  <option value="" disabled>
                    {typesLoading ? "Đang tải loại cầu…" : "Chọn loại cầu"}
                  </option>
                  {shuttleTypes.map((type) => (
                    <option
                      key={type.id}
                      value={type.id}
                      disabled={takenIds.has(type.id)}
                    >
                      {type.name} — {formatCurrency(shuttleUnitPrice(type))}
                    </option>
                  ))}
                </select>
                <CurrencyInput
                  value={line.quantity}
                  onChange={(quantity) => updateLine(line.key, { quantity })}
                  allowNegative={false}
                  selectOnFocus
                  enterKeyHint="next"
                  data-next="money"
                  aria-label={`Số quả cầu ${lineIndex + 1} của trận ${number}`}
                  data-field={`match-${index}-quantity-${lineIndex}`}
                  aria-invalid={lineErrors.quantity ? true : undefined}
                  aria-describedby={lineErrors.quantity ? errorId : undefined}
                  baseClassName="field-input"
                  className="text-right"
                />
                {removable && (
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    aria-label={`Xóa loại cầu ${lineIndex + 1} của trận ${number}`}
                    className="btn btn-ghost btn-icon text-slate-500"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {lineError && <FieldError id={errorId} message={lineError} />}
            </li>
          );
        })}
      </ul>
      {errors.noShuttleLines && (
        <FieldError
          id={`${uid}-no-shuttle-err`}
          message={errors.noShuttleLines}
        />
      )}
      <button
        type="button"
        onClick={() => onChange(addMatchShuttle(match, shuttleTypes))}
        disabled={!canAdd}
        data-field={`match-${index}-add-shuttle`}
        className="-ml-2 mt-1 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent sm:h-9"
      >
        <Plus className="h-4 w-4" />
        Thêm loại cầu
      </button>
    </div>
  );
}

/**
 * Một trận của bill chia theo trận: đôi / đơn, người đánh theo Cặp A vs Cặp B (sheet chọn người
 * cho từng bên), một hoặc nhiều loại cầu + số quả, dòng phụ tiền mỗi người của trận.
 * `data-field` khớp matchFormErrorList.
 *
 * @param {{
 *   index: number,
 *   match: { size: number, teams: number[][], shuttles: { key: number, shuttle_type_id: number|null, quantity: number }[] },
 *   nameOf: (userId: number) => string,
 *   shuttleTypes: object[],
 *   typesLoading?: boolean,
 *   line?: { subtotal: number, court_share: number, shuttle_share: number, per_player: number },
 *   errors?: { teams?: Record<number, string>, noShuttleLines?: string, lines?: Record<number, { shuttle?: string, quantity?: string }> },
 *   onChange: (match: object) => void,
 *   onOpenPicker: (team: 0 | 1) => void,
 *   onRemove: () => void,
 * }} props
 */
export default function MatchCard({
  index,
  match,
  nameOf,
  shuttleTypes,
  typesLoading = false,
  line,
  errors = {},
  onChange,
  onOpenPicker,
  onRemove,
}) {
  const uid = useId();
  const number = index + 1;

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

      <MatchTeamsField
        uid={uid}
        index={index}
        match={match}
        nameOf={nameOf}
        teamErrors={errors.teams}
        onChange={onChange}
        onOpenPicker={onOpenPicker}
      />

      <MatchShuttleLines
        uid={uid}
        index={index}
        match={match}
        shuttleTypes={shuttleTypes}
        typesLoading={typesLoading}
        errors={errors}
        onChange={onChange}
      />

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
