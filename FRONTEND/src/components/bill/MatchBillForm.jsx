import { useEffect, useMemo, useRef, useState } from "react";
import { playersApi, shuttlesApi } from "../../services/api";
import {
  calculateMatchPreview,
  defaultMatchShuttleTypeId,
  matchBillPayload,
  matchFormErrorList,
  newMatch,
  validateMatchForm,
} from "../../utils/matchBill";
import { serverErrorMessage } from "../../utils/billFormErrors";
import ConfirmDialog from "../common/ConfirmDialog";
import useToast from "../ui/useToast";
import { CircleAlert, Plus, Users } from "../ui/icons";
import { BillActionBar, BillBasicInfoCard } from "./BillFormSections";
import { focusField, focusNextOnEnter } from "./billFormFocus";
import MatchBillSummary from "./MatchBillSummary";
import MatchCard from "./MatchCard";
import PlayerPickerSheet from "./PlayerPickerSheet";
import useConfirmLeave from "./useConfirmLeave";

const FORM_ID = "match-bill-form";

const SPLIT_OPTIONS = [
  { value: "ratio", label: "Theo mức tính" },
  { value: "match", label: "Theo trận" },
];

/** Chọn cách chia tiền của bill con (màn tạo bill con). */
export function SplitModeSwitch({ value, onChange }) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:mb-6">
      <span
        id="split-mode-label"
        className="text-sm font-medium text-slate-700"
      >
        Cách chia tiền
      </span>
      <div
        role="radiogroup"
        aria-labelledby="split-mode-label"
        className="inline-flex rounded-xl border border-slate-200 bg-white p-1 shadow-card"
      >
        {SPLIT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={value === option.value}
            onClick={() => onChange(option.value)}
            className={`inline-flex h-10 items-center rounded-lg px-4 text-sm font-semibold transition sm:h-9 ${
              value === option.value
                ? "bg-emerald-600 text-white"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Danh sách người tải từ GET /players cho sheet thêm người ngoài bill chính. */
function useAllPlayers() {
  const [state, setState] = useState({
    players: null,
    loading: false,
    error: null,
  });

  const load = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const response = await playersApi.getAll();
      setState({ players: response.data || [], loading: false, error: null });
    } catch (error) {
      console.error("Error loading players:", error);
      setState({
        players: null,
        loading: false,
        error: "Không tải được danh sách người chơi.",
      });
    }
  };

  return { ...state, load };
}

/**
 * Form bill chia theo trận (tạo bill con / sửa bill chia theo trận): ngày, tiền sân, ghi chú,
 * rồi từng trận. Tự tải loại cầu theo ngày, kiểm lỗi (M14), hỏi lại khi rời màn và báo lỗi lưu.
 *
 * @param {{
 *   header: (onBackClick: Function) => import("react").ReactNode,
 *   intro?: import("react").ReactNode,
 *   initialForm: { date: string, note: string, court_total: number, matches: object[] },
 *   candidates: { user_id: number, name: string }[],
 *   backTo: string,
 *   onSave: (payload: object) => Promise<void>,
 *   submitLabel: string,
 *   busyLabel: string,
 *   errorPrefix: string,
 *   leave: { title: string, message: string, confirmLabel: string },
 *   noteHint?: string,
 * }} props
 */
export default function MatchBillForm({
  header,
  intro,
  initialForm,
  candidates: baseCandidates,
  backTo,
  onSave,
  submitLabel,
  busyLabel,
  errorPrefix,
  leave: leaveText,
  noteHint,
}) {
  const toast = useToast();
  const keyRef = useRef(0);
  const nextKey = () => {
    keyRef.current += 1;
    return keyRef.current;
  };

  const [form, setForm] = useState(() => ({
    ...initialForm,
    matches:
      initialForm.matches.length > 0
        ? initialForm.matches.map((m) => ({ ...m, key: nextKey() }))
        : [newMatch(nextKey())],
  }));
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [shuttleTypes, setShuttleTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [extraPlayers, setExtraPlayers] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const allPlayers = useAllPlayers();

  useEffect(() => {
    let cancelled = false;
    setTypesLoading(true);
    shuttlesApi
      .getAll({ params: { as_of: form.date } })
      .then((res) => {
        if (!cancelled) setShuttleTypes(res.data || []);
      })
      .catch((error) => console.error("Error loading shuttle types:", error))
      .finally(() => {
        if (!cancelled) setTypesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [form.date]);

  // Trận chưa có loại cầu (trận đầu khi mới mở) nhận loại mặc định khi tải xong loại cầu
  const defaultTypeId = defaultMatchShuttleTypeId(shuttleTypes);
  useEffect(() => {
    if (!defaultTypeId) return;
    setForm((prev) =>
      prev.matches.some((m) => !m.shuttle_type_id)
        ? {
            ...prev,
            matches: prev.matches.map((m) =>
              m.shuttle_type_id ? m : { ...m, shuttle_type_id: defaultTypeId },
            ),
          }
        : prev,
    );
  }, [defaultTypeId]);

  const candidates = useMemo(() => {
    const baseIds = new Set(baseCandidates.map((c) => c.user_id));
    return [
      ...baseCandidates,
      ...extraPlayers.filter((p) => !baseIds.has(p.user_id)),
    ];
  }, [baseCandidates, extraPlayers]);

  const preview = useMemo(
    () => calculateMatchPreview(form.court_total, form.matches, shuttleTypes),
    [form.court_total, form.matches, shuttleTypes],
  );
  const errors = useMemo(
    () => (submitted ? validateMatchForm(form) : null),
    [submitted, form],
  );

  const update = (updater) => {
    setTouched(true);
    setForm(updater);
  };
  const updateMatch = (key, updated) =>
    update((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => (m.key === key ? updated : m)),
    }));
  const removeMatch = (key) =>
    update((prev) => ({
      ...prev,
      matches: prev.matches.filter((m) => m.key !== key),
    }));
  const addMatch = () => {
    const match = newMatch(nextKey(), defaultTypeId);
    update((prev) => ({ ...prev, matches: [...prev.matches, match] }));
  };

  /** Sheet thêm người: chỉ thêm / bỏ người ngoài bill chính; bỏ thì gỡ khỏi các trận. */
  const togglePickedPlayer = (player, nextSelected) => {
    if (baseCandidates.some((c) => c.user_id === player.id)) return;
    if (nextSelected) {
      setExtraPlayers((prev) => [
        ...prev,
        { user_id: player.id, name: player.name },
      ]);
      return;
    }
    setExtraPlayers((prev) => prev.filter((p) => p.user_id !== player.id));
    update((prev) => ({
      ...prev,
      matches: prev.matches.map((m) => ({
        ...m,
        player_ids: m.player_ids.filter((id) => id !== player.id),
      })),
    }));
  };
  const openPicker = () => {
    setPickerOpen(true);
    if (!allPlayers.players && !allPlayers.loading) allPlayers.load();
  };

  const leave = useConfirmLeave({ when: touched && !loading, backTo });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (loading) return;

    setSubmitted(true);
    const errorList = matchFormErrorList(validateMatchForm(form));
    if (errorList.length > 0) {
      focusField(errorList[0].field);
      return;
    }
    try {
      setLoading(true);
      await onSave(matchBillPayload(form));
    } catch (error) {
      console.error("Error saving match bill:", error);
      toast.error(`${errorPrefix}: ${serverErrorMessage(error)}`, {
        onRetry: () => document.getElementById(FORM_ID)?.requestSubmit(),
      });
    } finally {
      setLoading(false);
    }
  };

  const summary = (
    <MatchBillSummary preview={preview} candidates={candidates} />
  );

  return (
    <>
      {header(leave.onBackClick)}
      {intro}

      <form id={FORM_ID} onSubmit={handleSubmit} onKeyDown={focusNextOnEnter}>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 md:items-start">
              <BillBasicInfoCard
                formData={form}
                onChange={(patch) => update((prev) => ({ ...prev, ...patch }))}
                noteHint={noteHint}
              />

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:col-span-2">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    Các trận
                    <span className="font-tabular ml-1 text-slate-500">
                      ({form.matches.length})
                    </span>
                  </h2>
                  <button
                    type="button"
                    onClick={openPicker}
                    className="btn btn-secondary btn-sm"
                  >
                    <Users className="h-4 w-4" />
                    Thêm người
                  </button>
                </div>
                <div className="space-y-3 p-4 sm:p-5">
                  {form.matches.map((match, index) => (
                    <MatchCard
                      key={match.key}
                      index={index}
                      match={match}
                      candidates={candidates}
                      shuttleTypes={shuttleTypes}
                      typesLoading={typesLoading}
                      line={preview.matches[index]}
                      errors={errors?.matches[index]}
                      onChange={(updated) => updateMatch(match.key, updated)}
                      onRemove={() => removeMatch(match.key)}
                    />
                  ))}
                  {errors?.noMatches && (
                    <p className="field-error">
                      <CircleAlert />
                      {errors.noMatches}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={addMatch}
                    data-field="matches"
                    className="flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-emerald-400 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50"
                  >
                    <Plus className="h-4 w-4" />
                    Thêm trận {form.matches.length + 1}
                  </button>
                </div>
              </section>
            </div>

            {/* Lưu — desktop (điện thoại dùng thanh đáy) */}
            <div className="hidden sm:flex sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => leave.requestLeave()}
                className="btn btn-secondary"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary px-6"
              >
                {loading ? busyLabel : submitLabel}
              </button>
            </div>
          </div>

          <div className="hidden sm:block lg:col-span-1">
            <div className="lg:sticky lg:top-20">{summary}</div>
          </div>
        </div>
      </form>

      <BillActionBar
        formId={FORM_ID}
        preview={preview}
        playerCount={preview.players.length}
        loading={loading}
        label={submitLabel}
        busyLabel={busyLabel}
        summaryContent={
          <MatchBillSummary
            preview={preview}
            candidates={candidates}
            variant="sheet"
          />
        }
      />

      <PlayerPickerSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        players={allPlayers.players || []}
        selectedIds={candidates.map((c) => c.user_id)}
        onToggle={togglePickedPlayer}
        loading={allPlayers.loading}
        error={allPlayers.error}
        onRetry={allPlayers.load}
        showRatio={false}
        scopeIds={baseCandidates.map((c) => c.user_id)}
        title="Thêm người ngoài bill chính"
        doneLabel={() => "Xong"}
      />

      <ConfirmDialog
        isOpen={leave.isOpen}
        onClose={leave.cancel}
        onConfirm={leave.confirm}
        title={leaveText.title}
        message={leaveText.message}
        confirmLabel={leaveText.confirmLabel}
      />
    </>
  );
}
