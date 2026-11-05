import { useMemo, useRef, useState } from "react";
import Modal from "../ui/Modal";
import EmptyState from "../ui/EmptyState";
import { Check, Plus, Search, X } from "../ui/icons";
import { formatCurrency, formatRatio } from "../../utils/formatters";
import {
  filterPickerPlayers,
  firstUnselectedPlayer,
  orderPickerPlayers,
} from "../../utils/playerSearch";

const GENDER_LABEL = { male: "Nam", female: "Nữ" };

const defaultDoneLabel = (count) => `Xong · ${count} người`;

function PickerRow({ player, selected, isEnterTarget, showRatio, onToggle }) {
  const gender = GENDER_LABEL[player.gender] ?? "-";
  return (
    <li>
      <button
        type="button"
        aria-pressed={selected}
        onClick={() => onToggle(player, !selected)}
        className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40 ${
          selected
            ? "bg-emerald-50 active:bg-emerald-100"
            : "active:bg-slate-100"
        } ${isEnterTarget ? "ring-2 ring-inset ring-emerald-600" : ""}`}
      >
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 flex-none items-center justify-center rounded-full ${
            selected
              ? "bg-emerald-700 text-white"
              : "border-2 border-slate-300 bg-white"
          }`}
        >
          {selected && <Check className="h-4 w-4" strokeWidth={2.5} />}
        </span>
        <span className="min-w-0 flex-1 break-words text-[15px] font-medium leading-5 text-slate-900">
          {player.name}
          {player.bill_count > 0 && (
            <span className="ml-1 font-normal text-slate-500">
              ({player.bill_count})
            </span>
          )}
        </span>
        <span className="flex flex-none flex-col items-end gap-0.5 text-xs text-slate-500">
          <span>
            {gender}
            {showRatio && (
              <>
                {" "}
                :{" "}
                <span className="font-tabular font-semibold text-slate-700">
                  {formatRatio(player.default_ratio_value || 1.0)}
                </span>
              </>
            )}
          </span>
          {player.current_debt_amount > 0 && (
            <span className="font-tabular font-medium text-rose-600">
              Nợ: {formatCurrency(player.current_debt_amount)}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * Phần thân sheet: chỉ dựng khi sheet mở, nên ô tìm trống và thứ tự "người đã chọn lên đầu"
 * được chụp lại mỗi lần mở; trong lúc mở, tick / bỏ tick không làm hàng đổi chỗ.
 */
function PickerBody({
  players,
  selectedIds,
  onToggle,
  loading,
  error,
  onRetry,
  showRatio,
  scopeIds,
  searchPlaceholder,
  onQuickAdd,
  bulkAction,
  notice,
}) {
  const [query, setQuery] = useState("");
  const [pinnedIds] = useState(() => [...selectedIds]);
  const searchRef = useRef(null);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const ordered = useMemo(
    () => orderPickerPlayers(players, pinnedIds),
    [players, pinnedIds],
  );
  const visible = useMemo(
    () =>
      filterPickerPlayers(ordered, {
        query,
        scopeIds,
        includeIds: selectedIds,
      }),
    [ordered, query, scopeIds, selectedIds],
  );
  const hasQuery = query.trim().length > 0;
  const enterTarget = hasQuery
    ? firstUnselectedPlayer(visible, selectedIds)
    : null;

  const handleSearchKeyDown = (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (!enterTarget) return;
    onToggle(enterTarget, true);
    setQuery("");
    searchRef.current?.focus();
  };

  const clearSearch = () => {
    setQuery("");
    searchRef.current?.focus();
  };

  const renderList = () => {
    if (loading) {
      return (
        <div className="py-6 text-center text-sm text-slate-500">
          Đang tải...
        </div>
      );
    }
    if (error) {
      return (
        <EmptyState compact tone="error" title={error} onRetry={onRetry} />
      );
    }
    if (visible.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-slate-500">
          {hasQuery
            ? "Không tìm thấy"
            : scopeIds
              ? "Bill chính chưa có người chơi — hãy tìm kiếm để chọn thêm"
              : "Không còn người chơi nào"}
          {hasQuery && onQuickAdd && (
            <button
              type="button"
              onClick={() => onQuickAdd(query.trim())}
              className="btn btn-secondary h-auto min-h-11 max-w-full whitespace-normal py-2"
            >
              <Plus className="h-4 w-4 flex-none" />
              <span className="min-w-0 break-words">
                Thêm "{query.trim()}" làm người chơi mới
              </span>
            </button>
          )}
        </div>
      );
    }
    return (
      <ul className="-mx-2.5 flex flex-col gap-1">
        {visible.map((player) => (
          <PickerRow
            key={player.id}
            player={player}
            selected={selectedSet.has(player.id)}
            isEnterTarget={enterTarget?.id === player.id}
            showRatio={showRatio}
            onToggle={onToggle}
          />
        ))}
      </ul>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="sticky -top-2 z-10 -mx-5 -mt-2 bg-white px-5 pb-1 pt-2">
        <label htmlFor="player-picker-search" className="sr-only">
          Tìm kiếm người chơi
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchRef}
            id="player-picker-search"
            type="text"
            enterKeyHint="done"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder={searchPlaceholder}
            className="field-input pl-9 pr-11"
          />
          {hasQuery && (
            <button
              type="button"
              onClick={clearSearch}
              aria-label="Xóa tìm kiếm"
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900">
          Đã chọn ({selectedIds.length})
        </h3>
        {onQuickAdd && (
          <button
            type="button"
            onClick={() => onQuickAdd("")}
            className="-mr-2 inline-flex h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-emerald-700 active:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
          >
            <Plus className="h-4 w-4" />
            Thêm nhanh
          </button>
        )}
      </div>

      {notice && (
        <p
          role="status"
          className="rounded-xl bg-sky-50 px-3 py-2 text-sm text-sky-800"
        >
          {notice}
        </p>
      )}

      {bulkAction && (
        <button
          type="button"
          onClick={bulkAction.onClick}
          className="btn btn-secondary w-full"
        >
          <Check className="h-4 w-4" strokeWidth={2.5} />
          {bulkAction.label}
        </button>
      )}

      {renderList()}
    </div>
  );
}

/**
 * Sheet "Chọn người chơi" chọn nhiều (M5): chạm hàng là tick / bỏ tick, hàng đứng yên; ô tìm gõ
 * không dấu, Enter chọn kết quả đầu chưa chọn rồi xóa ô và giữ con trỏ; tìm không ra thì
 * "Thêm "tên" làm người chơi mới". Dùng chung cho bill cầu (03) và bill tiệc (05).
 *
 * Màn cha giữ danh sách đã chọn và tải danh sách người chơi; sheet chỉ giữ chữ đang tìm.
 *
 * Props:
 * - isOpen, onClose
 * - players: mảng từ GET /players ({ id, name, gender, default_ratio_value, bill_count,
 *   current_debt_amount }), giữ thứ tự API
 * - selectedIds: user_id đang có trong bill
 * - onToggle(player, nextSelected): màn cha thêm (nextSelected = true) hoặc bỏ người
 * - loading, error (câu lỗi tải hoặc null), onRetry
 * - showRatio (mặc định true): hiện "Nam : 1"; bill tiệc truyền false (chỉ "Nam" / "Nữ")
 * - scopeIds: bill con — chưa gõ thì chỉ hiện người của bill chính
 * - searchPlaceholder, title, doneLabel(count)
 * - onQuickAdd(name): có thì hiện "Thêm nhanh" và nút tạo người mới mang tên vừa gõ
 * - bulkAction: { label, onClick } — nút chọn nhanh cả nhóm (vd "Chọn cả 12 người bill chính")
 * - notice: dòng thông báo trong sheet (thông báo M8 nằm dưới lớp nền mờ của sheet)
 */
export default function PlayerPickerSheet({
  isOpen,
  onClose,
  players = [],
  selectedIds = [],
  onToggle,
  loading = false,
  error = null,
  onRetry,
  showRatio = true,
  scopeIds = null,
  searchPlaceholder = "Tìm kiếm người chơi...",
  title = "Chọn người chơi",
  doneLabel = defaultDoneLabel,
  onQuickAdd,
  bulkAction,
  notice,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      height="tall"
      initialFocus="panel"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="btn btn-primary w-full"
        >
          {doneLabel(selectedIds.length)}
        </button>
      }
    >
      {isOpen && (
        <PickerBody
          players={players}
          selectedIds={selectedIds}
          onToggle={onToggle}
          loading={loading}
          error={error}
          onRetry={onRetry}
          showRatio={showRatio}
          scopeIds={scopeIds}
          searchPlaceholder={searchPlaceholder}
          onQuickAdd={onQuickAdd}
          bulkAction={bulkAction}
          notice={notice}
        />
      )}
    </Modal>
  );
}
