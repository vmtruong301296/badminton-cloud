import { useState, useEffect, useMemo } from "react";
import { playersApi } from "../../services/api";
import { formatRatio, formatCurrency } from "../../utils/formatters";
import {
  useGenderDefaultRatios,
  ratioForGender,
} from "../../utils/genderRatio";
import {
  RECENT_SCOPE_TEXT,
  findPlayerByName,
  matchesPlayerSearch,
  recentPlayerIds,
  sortByRecentBills,
} from "../../utils/playerSearch";
import Modal from "../ui/Modal";
import useToast from "../ui/useToast";
import PlayerPickerSheet from "./PlayerPickerSheet";
import { CircleAlert, Plus, Search, X } from "../ui/icons";

const LOAD_ERROR = "Không tải được danh sách người chơi.";

/**
 * Chọn người chơi cho bill. Desktop: hai cột (Danh sách / Đã chọn) như cũ. Điện thoại: sheet
 * PlayerPickerSheet do màn mở qua `pickerOpen` / `onPickerClose`. Giữ việc tải danh sách và
 * "Thêm nhanh người chơi" cho cả hai.
 */
export default function PlayerSelector({
  selectedPlayers,
  onSelect,
  onRemove,
  // Danh sách user_id người chơi từ bill chính (chỉ dùng khi tạo bill con).
  // Khi chưa search: danh sách mặc định chỉ hiện những người này.
  // Khi search: tìm trong toàn bộ người chơi để chọn thêm người ngoài bill chính.
  // Bill chính (không truyền): danh sách mặc định là người các bill chính gần đây.
  parentPlayerIds = null,
  pickerOpen = false,
  onPickerClose,
}) {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [nameError, setNameError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pickerNotice, setPickerNotice] = useState(null);
  const toast = useToast();
  const genderRatios = useGenderDefaultRatios();
  const [newPlayer, setNewPlayer] = useState({
    name: "",
    gender: "male",
    default_ratio: 1,
  });

  // Đổi giới tính -> mức tính tự nhảy về mặc định của giới tính đó (Nam 1, Nữ 0.7)
  const handleGenderChange = (gender) =>
    setNewPlayer((prev) => ({
      ...prev,
      gender,
      default_ratio: ratioForGender(genderRatios, gender),
    }));

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const response = await playersApi.getAll();
      setPlayers(response.data);
    } catch (error) {
      console.error("Error loading players:", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const isChildBill = Array.isArray(parentPlayerIds);
  const parentIdSet = isChildBill ? new Set(parentPlayerIds) : null;
  const hasSearch = search.trim().length > 0;

  // Chưa search: bill con chỉ hiện người của bill chính (thứ tự API); bill chính chỉ hiện người
  // các bill chính gần đây, ai đánh gần nhất lên đầu
  const listPlayers = useMemo(
    () => (isChildBill ? players : sortByRecentBills(players)),
    [players, isChildBill],
  );
  const scopeIds = isChildBill ? parentPlayerIds : recentPlayerIds(listPlayers);
  const scopeSet = new Set(scopeIds);

  const filteredPlayers = listPlayers.filter((p) => {
    const isSelected = selectedPlayers.some((sp) => sp.user_id === p.id);
    if (isSelected) return false;
    if (!hasSearch) return scopeSet.has(p.id);
    // Có search: tìm trong toàn bộ người chơi (kể cả ngoài bill chính)
    return matchesPlayerSearch(p.name, search);
  });

  const handleSelect = (player) => {
    onSelect({
      user_id: player.id,
      name: player.name,
      gender: player.gender,
      ratio_value: player.default_ratio_value || 1.0,
      default_ratio_value: player.default_ratio_value || 1.0,
      debt_amount: player.current_debt_amount || 0,
      debt_date: player.debt_date,
      include_debt: false,
      menus: [],
    });
    setSearch("");
  };

  // Sheet chọn người đang mở thì thông báo nằm trong sheet (M8 nằm dưới lớp nền mờ).
  const notify = (message) => {
    if (pickerOpen) setPickerNotice(message);
    else toast.info(message);
  };

  const openAddModal = (name = "") => {
    setNewPlayer({
      name,
      gender: "male",
      default_ratio: ratioForGender(genderRatios, "male"),
    });
    setNameError("");
    setSaveError("");
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
  };

  const closePicker = () => {
    setPickerNotice(null);
    onPickerClose?.();
  };

  const handlePickerToggle = (player, nextSelected) => {
    setPickerNotice(null);
    if (nextSelected) {
      handleSelect(player);
      return;
    }
    const index = selectedPlayers.findIndex((sp) => sp.user_id === player.id);
    if (index >= 0) onRemove(index);
  };

  // Bill con: chọn một lần mọi người của bill chính chưa có trong bill
  const parentPlayers = parentIdSet
    ? players.filter((p) => parentIdSet.has(p.id))
    : [];
  const parentNotSelected = parentPlayers.filter(
    (p) => !selectedPlayers.some((sp) => sp.user_id === p.id),
  );
  const bulkAction =
    parentNotSelected.length > 0
      ? {
          label: `Chọn cả ${parentPlayers.length} người bill chính`,
          onClick: () => parentNotSelected.forEach((p) => handleSelect(p)),
        }
      : undefined;

  const handleCreatePlayer = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Ngăn event bubble lên form cha

    if (saving) return;
    setSaveError("");

    if (!newPlayer.name.trim()) {
      setNameError("Vui lòng nhập tên người chơi");
      document.getElementById("quick-player-name")?.focus();
      return;
    }

    // Kiểm tra trùng tên: nếu đã tồn tại thì không tạo mới, chọn luôn người có sẵn
    const existing = findPlayerByName(players, newPlayer.name);
    if (existing) {
      const alreadyInBill = selectedPlayers.some(
        (p) => p.user_id === existing.id,
      );
      if (alreadyInBill) {
        notify(`Người chơi "${existing.name}" đã có trong bill.`);
        closeAddModal();
        return;
      }
      notify(
        `Người chơi "${existing.name}" đã tồn tại. Đã chọn người này thay vì tạo mới.`,
      );
      handleSelect({
        id: existing.id,
        name: existing.name,
        gender: existing.gender,
        default_ratio_value:
          existing.default_ratio_value ?? existing.default_ratio ?? 1,
        current_debt_amount: existing.current_debt_amount ?? 0,
        debt_date: existing.debt_date ?? null,
      });
      closeAddModal();
      return;
    }

    const slug = newPlayer.name.trim().toLowerCase().replace(/\s+/g, "");
    const email = `${slug || "player"}${Date.now()}@badminton.local`;

    try {
      setSaving(true);
      const payload = {
        name: newPlayer.name.trim(),
        gender: newPlayer.gender,
        default_ratio: newPlayer.default_ratio,
        email,
        password: "password",
      };
      const response = await playersApi.create(payload);

      // Reload list and auto-select player vừa thêm
      await loadPlayers();
      handleSelect({
        id: response.data.id,
        name: response.data.name,
        gender: response.data.gender,
        default_ratio_value:
          response.data.default_ratio ?? newPlayer.default_ratio ?? 1,
        current_debt_amount: 0,
        debt_date: null,
      });

      closeAddModal();
    } catch (error) {
      console.error("Error creating player:", error);
      setSaveError("Không thể tạo người chơi mới. Vui lòng thử lại.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="hidden grid-cols-1 gap-4 sm:grid md:grid-cols-2">
      {/* Cột trái: Danh sách người chơi để chọn */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Danh sách người chơi
          </h3>
          <button
            type="button"
            onClick={() => openAddModal()}
            className="btn btn-secondary btn-sm"
          >
            <Plus className="h-4 w-4" />
            Thêm nhanh
          </button>
        </div>
        <label htmlFor="player-search" className="sr-only">
          Tìm kiếm người chơi
        </label>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            id="player-search"
            type="text"
            data-field="players"
            placeholder={
              parentIdSet
                ? "Tìm kiếm để chọn thêm người ngoài bill chính..."
                : RECENT_SCOPE_TEXT.placeholder
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-input pl-9"
          />
        </div>
        {loading ? (
          <div className="py-4 text-center text-sm text-slate-500">
            Đang tải...
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="flex flex-col items-center gap-2 py-4 text-center text-sm text-rose-700"
          >
            {LOAD_ERROR}
            <button
              type="button"
              onClick={loadPlayers}
              className="btn btn-secondary btn-sm"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {!isChildBill && !hasSearch && filteredPlayers.length > 0 && (
              <p className="mb-2 text-xs text-slate-500">
                {RECENT_SCOPE_TEXT.hint}
              </p>
            )}
            {filteredPlayers.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-500">
                {search
                  ? "Không tìm thấy"
                  : parentIdSet
                    ? "Bill chính chưa có người chơi — hãy tìm kiếm để chọn thêm"
                    : scopeIds.length === 0
                      ? RECENT_SCOPE_TEXT.empty
                      : RECENT_SCOPE_TEXT.allPicked}
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {filteredPlayers.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(player)}
                      className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-emerald-50 focus:outline-none focus-visible:bg-emerald-50"
                    >
                      <div className="min-w-0 break-words text-sm font-medium text-slate-900">
                        {player.name}
                        {player.bill_count !== undefined &&
                          player.bill_count > 0 && (
                            <span className="ml-1 font-normal text-slate-500">
                              ({player.bill_count})
                            </span>
                          )}
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-0.5 text-xs text-slate-500 sm:flex-row sm:items-center sm:gap-3">
                        <span>
                          {player.gender === "male"
                            ? "Nam"
                            : player.gender === "female"
                              ? "Nữ"
                              : "-"}{" "}
                          :{" "}
                          <span className="font-tabular font-semibold">
                            {formatRatio(player.default_ratio_value || 1.0)}
                          </span>
                        </span>
                        {player.current_debt_amount > 0 && (
                          <span className="font-tabular font-medium text-rose-600">
                            Nợ: {formatCurrency(player.current_debt_amount)}
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Cột phải: Danh sách đã chọn */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3 sm:p-4">
        <h3 className="mb-3 text-sm font-semibold text-slate-900">
          Đã chọn ({selectedPlayers.length})
        </h3>
        {selectedPlayers.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-500">
            Chưa chọn người chơi nào
          </div>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {selectedPlayers.map((player, index) => (
              <div
                key={player.user_id || index}
                className="rounded-xl border border-emerald-100 bg-white p-3 shadow-card"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
                    <div className="min-w-0 break-words text-sm font-semibold text-slate-900">
                      {player.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {player.gender === "male"
                        ? "Nam"
                        : player.gender === "female"
                          ? "Nữ"
                          : "-"}{" "}
                      :{" "}
                      <span className="font-tabular font-semibold">
                        {formatRatio(
                          player.ratio_value ??
                            player.default_ratio_value ??
                            1.0,
                        )}
                      </span>
                    </div>
                    {player.menus && player.menus.length > 0 && (
                      <div className="text-xs text-emerald-700">
                        Menu: {player.menus.length} món
                      </div>
                    )}
                    {player.debt_amount > 0 && player.include_debt && (
                      <div className="font-tabular text-xs text-rose-600">
                        Nợ: {formatCurrency(player.debt_amount)}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemove(index)}
                    aria-label={`Xóa ${player.name}`}
                    className="-m-1.5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 sm:-m-1 sm:h-9 sm:w-9"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal thêm nhanh người chơi */}
      <Modal
        isOpen={showAddModal}
        onClose={closeAddModal}
        title="Thêm nhanh người chơi"
        footer={
          <div className="flex gap-2 sm:justify-end">
            <button
              type="button"
              onClick={closeAddModal}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreatePlayer}
              disabled={saving}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          {saveError && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 flex-none" />
              {saveError}
            </p>
          )}
          <div>
            <label htmlFor="quick-player-name" className="field-label">
              Tên
            </label>
            <input
              id="quick-player-name"
              type="text"
              value={newPlayer.name}
              onChange={(e) => {
                setNewPlayer({ ...newPlayer, name: e.target.value });
                setNameError("");
              }}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "quick-player-name-err" : undefined}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreatePlayer(e);
                }
              }}
              className="field-input"
              placeholder="Nhập tên người chơi"
            />
            {nameError && (
              <p id="quick-player-name-err" className="field-error">
                <CircleAlert />
                {nameError}
              </p>
            )}
          </div>
          <div>
            <label
              id="quick-player-gender-label"
              htmlFor="quick-player-gender"
              className="field-label"
            >
              Giới tính
            </label>
            {/* Điện thoại: 2 nút Nam / Nữ (1 chạm); desktop giữ ô chọn */}
            <div
              role="radiogroup"
              aria-labelledby="quick-player-gender-label"
              className="choice-list sm:hidden"
            >
              {[
                ["male", "Nam"],
                ["female", "Nữ"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={newPlayer.gender === value}
                  onClick={() => handleGenderChange(value)}
                  className="choice"
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              id="quick-player-gender"
              value={newPlayer.gender}
              onChange={(e) => handleGenderChange(e.target.value)}
              className="field-input hidden sm:block"
            >
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>
          <div>
            <label htmlFor="quick-player-ratio" className="field-label">
              Mức tính mặc định
            </label>
            <input
              id="quick-player-ratio"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={newPlayer.default_ratio}
              onChange={(e) =>
                setNewPlayer({
                  ...newPlayer,
                  default_ratio: parseFloat(e.target.value) || 1,
                })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreatePlayer(e);
                }
              }}
              className="field-input"
            />
          </div>
          <p className="text-xs text-slate-500">
            Ghi chú: tài khoản tạo nhanh dùng mật khẩu mặc định "password".
          </p>
        </div>
      </Modal>

      <PlayerPickerSheet
        isOpen={pickerOpen}
        onClose={closePicker}
        players={listPlayers}
        selectedIds={selectedPlayers.map((p) => p.user_id)}
        onToggle={handlePickerToggle}
        loading={loading}
        error={loadError ? LOAD_ERROR : null}
        onRetry={loadPlayers}
        scopeIds={scopeIds}
        scopeHint={isChildBill ? undefined : RECENT_SCOPE_TEXT.hint}
        scopeEmptyText={isChildBill ? undefined : RECENT_SCOPE_TEXT.empty}
        searchPlaceholder={
          parentIdSet
            ? "Tìm kiếm để chọn thêm người ngoài bill chính..."
            : RECENT_SCOPE_TEXT.placeholder
        }
        onQuickAdd={openAddModal}
        bulkAction={bulkAction}
        notice={pickerNotice}
      />
    </div>
  );
}
