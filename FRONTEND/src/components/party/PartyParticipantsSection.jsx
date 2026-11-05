import { useMemo, useState } from "react";
import CurrencyInput from "../common/CurrencyInput";
import NumberInput from "../common/NumberInput";
import PlayerPickerSheet from "../bill/PlayerPickerSheet";
import PartyParticipantSheet, {
  GenderTag,
  PaidTag,
} from "./PartyParticipantSheet";
import PartyQuickAddPlayer from "./PartyQuickAddPlayer";
import { ChevronRight, CircleAlert, Plus, Users, X } from "../ui/icons";
import {
  formatCurrency,
  formatCurrencyRounded,
  formatRatio,
} from "../../utils/formatters";
import { normalizeSearch } from "../../utils/playerSearch";
import { participantExceptions } from "../../utils/partyBillTotals";

const EXCEPTION_LABEL = {
  ratio: (v) => `Mức tính ${formatRatio(v)}`,
  paid: (v) => `Đã chi ${formatCurrency(v)}`,
  food: (v) => `Tiền thêm ${formatCurrency(v)}`,
  note: (v) => v,
};

/** Hàng một người trên điện thoại: tên + Nam/Nữ (+ Đã TT), dòng phụ chỉ ghi ngoại lệ, thành tiền. */
function ParticipantRow({ participant, onOpen }) {
  const exceptions = participantExceptions(participant);
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={`list-row pr-3 ${participant.is_paid ? "bg-emerald-50/40" : ""}`}
      >
        <div className="list-row-text">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="break-words text-[15px] font-semibold leading-5 text-slate-900 [overflow-wrap:anywhere]">
              {participant.name}
            </span>
            <GenderTag gender={participant.gender} />
            {participant.is_paid && <PaidTag />}
          </div>
          {exceptions.length > 0 && (
            <div className="list-row-sub">
              {exceptions
                .map((item) => EXCEPTION_LABEL[item.key](item.value))
                .join(" · ")}
            </div>
          )}
        </div>
        <span className="amount flex-none text-emerald-700">
          {formatCurrencyRounded(participant.totalAmount)}
        </span>
        <ChevronRight className="list-row-chevron" />
      </button>
    </li>
  );
}

/**
 * Thẻ "Người tham gia" của form bill tiệc.
 * - Desktop (từ sm): như cũ — danh sách chọn bên trái, thẻ 4 ô mỗi người.
 * - Điện thoại: "Chọn người" mở sheet chọn nhiều dùng chung (PlayerPickerSheet, không hiện mức
 *   tính); mỗi người một hàng "chỉ ghi ngoại lệ", chạm hàng mở sheet sửa một người.
 *
 * participants: người tham gia đã kèm share / totalAmount (partyBillPreview).
 * Người đã TT (màn sửa, is_paid) có nhãn "Đã TT", không xóa được, không nằm trong sheet chọn.
 * onPlayerCreated(player): sau "Thêm nhanh" — màn tải lại người chơi rồi chọn người mới.
 * error: lỗi "ít nhất 1 người" (M14).
 */
export default function PartyParticipantsSection({
  participants,
  players,
  loadingPlayers,
  playersError,
  onRetryPlayers,
  onSelectPlayer,
  onUnselectPlayer,
  onUpdate,
  onRemove,
  onPlayerCreated,
  desktopEmptyText,
  error,
}) {
  const [playerSearch, setPlayerSearch] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [quickAdd, setQuickAdd] = useState({ isOpen: false, name: "" });

  const availablePlayers = useMemo(() => {
    const search = normalizeSearch(playerSearch);
    return players.filter((p) => {
      const already = participants.some((sp) => sp.user_id === p.id);
      if (already) return false;
      if (!search) return true;
      return normalizeSearch(p.name).includes(search);
    });
  }, [players, participants, playerSearch]);

  // Người đã TT (màn sửa) không bỏ được nên không đưa vào sheet chọn.
  const paidIds = new Set(
    participants.filter((p) => p.is_paid && p.user_id).map((p) => p.user_id),
  );
  const pickerPlayers = players.filter((p) => !paidIds.has(p.id));
  const selectedIds = participants
    .filter((p) => p.user_id && !paidIds.has(p.user_id))
    .map((p) => p.user_id);
  const errorId = error ? "pbc-participants-err" : undefined;
  const errorText = error && (
    <p id="pbc-participants-err" className="field-error">
      <CircleAlert />
      {error}
    </p>
  );

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
        <p className="text-sm font-semibold text-slate-900">Người tham gia</p>
        {participants.length > 0 && (
          <span className="font-tabular text-xs text-slate-500">
            {participants.length} người
          </span>
        )}
      </div>

      {/* Điện thoại */}
      <div className="sm:hidden">
        <div className="space-y-3 p-4">
          {participants.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-4 py-6 text-center text-sm text-slate-500">
              Chưa có người tham gia.
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-haspopup="dialog"
              aria-describedby={errorId}
              data-field="participants"
              className="btn btn-secondary w-full"
            >
              <Users className="h-[18px] w-[18px]" />
              Chọn người
            </button>
            {errorText}
          </div>
        </div>
        {participants.length > 0 && (
          <ul className="divide-y divide-slate-100 border-t border-slate-100">
            {participants.map((p, idx) => (
              <ParticipantRow
                key={idx}
                participant={p}
                onOpen={() => setEditingIndex(idx)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Desktop */}
      <div className="hidden grid-cols-1 gap-4 p-4 sm:grid sm:p-5 md:grid-cols-3 md:gap-6">
        <div className="md:col-span-1">
          <div className="mb-2 flex items-center justify-between">
            <label
              htmlFor="pbc-search"
              className="text-sm font-medium text-slate-700"
            >
              Chọn người
            </label>
            <button
              type="button"
              onClick={() => setQuickAdd({ isOpen: true, name: "" })}
              className="btn btn-ghost btn-sm -mr-2 text-emerald-700 hover:bg-emerald-50"
            >
              <Plus className="h-4 w-4" />
              Thêm nhanh
            </button>
          </div>
          <input
            id="pbc-search"
            type="text"
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            placeholder="Tìm tên..."
            data-field="participants"
            aria-describedby={errorId}
            className="field-input"
          />
          <div className="mt-2 grid max-h-[480px] grid-cols-2 gap-1.5 overflow-y-auto pr-1 text-sm sm:grid-cols-1 sm:gap-1">
            {loadingPlayers ? (
              <div className="col-span-2 py-4 text-center text-slate-500 sm:col-span-1">
                Đang tải...
              </div>
            ) : availablePlayers.length === 0 ? (
              <div className="col-span-2 py-4 text-center text-slate-500 sm:col-span-1">
                Không tìm thấy
              </div>
            ) : (
              availablePlayers.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPlayer(p)}
                  className="min-h-[44px] w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50 sm:border-transparent sm:bg-transparent sm:px-3"
                >
                  <div className="truncate font-medium text-slate-900">
                    {p.name}
                  </div>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-slate-500">
                    <span>
                      {p.gender === "male"
                        ? "Nam"
                        : p.gender === "female"
                          ? "Nữ"
                          : "-"}
                    </span>
                    <span>
                      Mức:{" "}
                      {formatRatio(
                        p.default_ratio_value ?? p.default_ratio ?? 1,
                      )}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="md:col-span-2">
          {participants.length === 0 ? (
            <>
              <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-4 py-8 text-center text-sm text-slate-500">
                {desktopEmptyText}
              </div>
              {errorText}
            </>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3">
              {participants.map((p, idx) => (
                <article
                  key={idx}
                  className={`overflow-hidden rounded-xl border ${
                    p.is_paid
                      ? "border-emerald-200 bg-emerald-50/40"
                      : "border-slate-200 bg-slate-50/60"
                  }`}
                >
                  <div className="flex flex-col gap-1.5 border-b border-slate-100 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                      <h4 className="min-w-0 truncate font-display text-sm font-semibold text-slate-900 sm:text-base">
                        {p.name}
                      </h4>
                      <GenderTag gender={p.gender} />
                      {p.is_paid && <PaidTag />}
                    </div>
                    <div className="flex items-center justify-between gap-2 sm:justify-end">
                      <span className="font-display font-tabular text-sm font-semibold text-emerald-700 sm:text-base">
                        {formatCurrencyRounded(p.totalAmount)}
                      </span>
                      {!p.is_paid && (
                        <button
                          type="button"
                          onClick={() => onRemove(idx)}
                          aria-label={`Xóa ${p.name}`}
                          className="-my-1 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 sm:h-9 sm:w-9"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-4">
                    <div>
                      <label
                        htmlFor={`pbc-p${idx}-ratio`}
                        className="mb-1 block text-xs font-medium text-slate-600"
                      >
                        Mức tính
                      </label>
                      <NumberInput
                        id={`pbc-p${idx}-ratio`}
                        value={p.ratio_value}
                        onChange={(value) =>
                          onUpdate(idx, "ratio_value", value)
                        }
                        min={0}
                        step={0.1}
                        baseClassName="field-input"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`pbc-p${idx}-paid`}
                        className="mb-1 block text-xs font-medium text-slate-600"
                      >
                        Đã chi
                      </label>
                      <CurrencyInput
                        id={`pbc-p${idx}-paid`}
                        value={p.paid_amount || 0}
                        onChange={(value) =>
                          onUpdate(idx, "paid_amount", value)
                        }
                        baseClassName="field-input"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`pbc-p${idx}-food`}
                        className="mb-1 block text-xs font-medium text-slate-600"
                      >
                        Tiền thêm
                      </label>
                      <CurrencyInput
                        id={`pbc-p${idx}-food`}
                        value={p.food_amount || 0}
                        onChange={(value) =>
                          onUpdate(idx, "food_amount", value)
                        }
                        baseClassName="field-input"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor={`pbc-p${idx}-note`}
                        className="mb-1 block text-xs font-medium text-slate-600"
                      >
                        Ghi chú
                      </label>
                      <input
                        id={`pbc-p${idx}-note`}
                        type="text"
                        value={p.note || ""}
                        onChange={(e) => onUpdate(idx, "note", e.target.value)}
                        className="field-input"
                        placeholder="—"
                      />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <PlayerPickerSheet
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Chọn người"
        doneLabel={() => "Xong"}
        searchPlaceholder="Tìm tên..."
        players={pickerPlayers}
        selectedIds={selectedIds}
        onToggle={(player, selected) =>
          selected ? onSelectPlayer(player) : onUnselectPlayer(player.id)
        }
        loading={loadingPlayers}
        error={playersError ? "Không tải được danh sách người chơi." : null}
        onRetry={onRetryPlayers}
        showRatio={false}
        onQuickAdd={(name) => setQuickAdd({ isOpen: true, name })}
      />

      <PartyParticipantSheet
        participant={
          editingIndex !== null ? participants[editingIndex] || null : null
        }
        onClose={() => setEditingIndex(null)}
        onChange={(key, value) => onUpdate(editingIndex, key, value)}
        onRemove={() => {
          onRemove(editingIndex);
          setEditingIndex(null);
        }}
      />

      <PartyQuickAddPlayer
        isOpen={quickAdd.isOpen}
        initialName={quickAdd.name}
        onClose={() => setQuickAdd({ isOpen: false, name: "" })}
        onCreated={onPlayerCreated}
      />
    </section>
  );
}
