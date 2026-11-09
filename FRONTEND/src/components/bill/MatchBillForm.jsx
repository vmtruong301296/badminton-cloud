import { useEffect, useMemo, useRef, useState } from "react";
import { shuttlesApi } from "../../services/api";
import {
  SPLIT_MATCH,
  SPLIT_RATIO,
  calculateMatchPreview,
  defaultMatchShuttleTypeId,
  fillDefaultShuttleTypes,
  matchBillPayload,
  matchFormErrorList,
  newMatch,
  validateMatchForm,
} from "../../utils/matchBill";
import { serverErrorMessage } from "../../utils/billFormErrors";
import ConfirmDialog from "../common/ConfirmDialog";
import useToast from "../ui/useToast";
import { CircleAlert, Plus } from "../ui/icons";
import { BillActionBar, BillBasicInfoCard } from "./BillFormSections";
import { focusField, focusNextOnEnter } from "./billFormFocus";
import MatchBillSummary from "./MatchBillSummary";
import MatchCard from "./MatchCard";
import MatchPlayerPicker from "./MatchPlayerPicker";
import useAllPlayers from "./useAllPlayers";
import useConfirmLeave from "./useConfirmLeave";

const FORM_ID = "match-bill-form";

const SPLIT_OPTIONS = [
  { value: SPLIT_MATCH, label: "Theo trận" },
  { value: SPLIT_RATIO, label: "Theo mức tính" },
];

/** Chọn cách chia tiền ở màn tạo bill (bill chính và bill con). */
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

/**
 * Form bill chia theo trận (tạo / sửa, bill chính hoặc bill con): ngày, tiền sân, ghi chú,
 * rồi từng trận. Tự tải loại cầu theo ngày, kiểm lỗi (M14), hỏi lại khi rời màn và báo lỗi lưu.
 * `scopeToCandidates` (mặc định true, bill con): sheet chọn người chưa gõ chỉ hiện `candidates`;
 * false (bill chính): hiện mọi người chơi.
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
 *   scopeToCandidates?: boolean,
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
  scopeToCandidates = true,
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
  // Người chọn từ sheet mà không có trong candidates (để hiện tên)
  const [extraPlayers, setExtraPlayers] = useState([]);
  // Sheet chọn người đang mở: { key: key của trận, team: 0 (Cặp A) | 1 (Cặp B) }
  const [picker, setPicker] = useState(null);
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

  // Dòng cầu chưa có loại (trận đầu khi mới mở) nhận loại mặc định khi tải xong loại cầu
  const defaultTypeId = defaultMatchShuttleTypeId(shuttleTypes);
  useEffect(() => {
    if (shuttleTypes.length === 0) return;
    setForm((prev) => {
      const matches = fillDefaultShuttleTypes(prev.matches, shuttleTypes);
      return matches === prev.matches ? prev : { ...prev, matches };
    });
  }, [shuttleTypes]);

  const candidates = useMemo(() => {
    const baseIds = new Set(baseCandidates.map((c) => c.user_id));
    return [
      ...baseCandidates,
      ...extraPlayers.filter((p) => !baseIds.has(p.user_id)),
    ];
  }, [baseCandidates, extraPlayers]);
  const nameOf = (userId) =>
    candidates.find((c) => c.user_id === userId)?.name ?? `#${userId}`;

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

  const pickerIndex = form.matches.findIndex((m) => m.key === picker?.key);
  const openPicker = (key, team) => {
    setPicker({ key, team });
    allPlayers.loadOnce();
  };
  /** Người chọn ngoài candidates: nhớ tên để hiện ở trận và phần tóm tắt. */
  const rememberPlayer = (player) =>
    setExtraPlayers((prev) =>
      prev.some((p) => p.user_id === player.user_id) ? prev : [...prev, player],
    );

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
                courtError={errors?.court}
                noteHint={noteHint}
              />

              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:col-span-2">
                <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    Các trận
                    <span className="font-tabular ml-1 text-slate-500">
                      ({form.matches.length})
                    </span>
                  </h2>
                </div>
                <div className="space-y-3 p-4 sm:p-5">
                  {form.matches.map((match, index) => (
                    <MatchCard
                      key={match.key}
                      index={index}
                      match={match}
                      nameOf={nameOf}
                      shuttleTypes={shuttleTypes}
                      typesLoading={typesLoading}
                      line={preview.matches[index]}
                      errors={errors?.matches[index]}
                      onChange={(updated) => updateMatch(match.key, updated)}
                      onOpenPicker={(team) => openPicker(match.key, team)}
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

      <MatchPlayerPicker
        match={form.matches[pickerIndex] ?? null}
        team={picker?.team ?? 0}
        number={pickerIndex + 1}
        scopeIds={
          scopeToCandidates ? baseCandidates.map((c) => c.user_id) : null
        }
        allPlayers={allPlayers}
        onChange={(updated) => updateMatch(updated.key, updated)}
        onPicked={rememberPlayer}
        onClose={() => setPicker(null)}
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
