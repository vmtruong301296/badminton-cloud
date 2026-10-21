import { useState, useEffect } from "react";
import { playersApi } from "../../services/api";
import { formatRatio, formatCurrency } from "../../utils/formatters";
import {
  useGenderDefaultRatios,
  ratioForGender,
} from "../../utils/genderRatio";
import Modal from "../ui/Modal";
import { Plus, Search, X } from "../ui/icons";

export default function PlayerSelector({
  selectedPlayers,
  onSelect,
  onRemove,
  // Danh sách user_id người chơi từ bill chính (chỉ dùng khi tạo bill con).
  // Khi chưa search: danh sách mặc định chỉ hiện những người này.
  // Khi search: tìm trong toàn bộ người chơi để chọn thêm người ngoài bill chính.
  parentPlayerIds = null,
}) {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
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
      const response = await playersApi.getAll();
      setPlayers(response.data);
    } catch (error) {
      console.error("Error loading players:", error);
    } finally {
      setLoading(false);
    }
  };

  // Hàm loại bỏ dấu tiếng Việt
  const removeVietnameseTones = (str) => {
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  };

  const parentIdSet = Array.isArray(parentPlayerIds)
    ? new Set(parentPlayerIds)
    : null;
  const hasSearch = search.trim().length > 0;

  const filteredPlayers = players.filter((p) => {
    const isSelected = selectedPlayers.some((sp) => sp.user_id === p.id);
    if (isSelected) return false;
    if (!hasSearch) {
      // Chưa search: nếu là bill con thì chỉ hiện người chơi từ bill chính
      if (parentIdSet) return parentIdSet.has(p.id);
      return true;
    }
    // Có search: tìm trong toàn bộ người chơi (kể cả ngoài bill chính)
    const searchNoTones = removeVietnameseTones(search.toLowerCase());
    const playerNameNoTones = removeVietnameseTones(p.name.toLowerCase());
    return playerNameNoTones.includes(searchNoTones);
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

  const openAddModal = () => {
    setNewPlayer({
      name: "",
      gender: "male",
      default_ratio: ratioForGender(genderRatios, "male"),
    });
    setShowAddModal(true);
  };

  const closeAddModal = () => {
    setShowAddModal(false);
  };

  const handleCreatePlayer = async (e) => {
    e.preventDefault();
    e.stopPropagation(); // Ngăn event bubble lên form cha

    if (!newPlayer.name.trim()) {
      alert("Vui lòng nhập tên người chơi");
      return;
    }

    // Kiểm tra trùng tên: nếu đã tồn tại thì không tạo mới, chọn luôn người có sẵn
    const nameKey = newPlayer.name.trim().toLowerCase();
    const existing = players.find(
      (p) => (p.name || "").trim().toLowerCase() === nameKey,
    );
    if (existing) {
      const alreadyInBill = selectedPlayers.some(
        (p) => p.user_id === existing.id,
      );
      if (alreadyInBill) {
        alert(`Người chơi "${existing.name}" đã có trong bill.`);
        closeAddModal();
        return;
      }
      alert(
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
      alert("Không thể tạo người chơi mới. Vui lòng thử lại.");
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Cột trái: Danh sách người chơi để chọn */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Danh sách người chơi
          </h3>
          <button
            type="button"
            onClick={openAddModal}
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
            placeholder={
              parentIdSet
                ? "Tìm kiếm để chọn thêm người ngoài bill chính..."
                : "Tìm kiếm người chơi..."
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
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {filteredPlayers.length === 0 ? (
              <div className="py-4 text-center text-sm text-slate-500">
                {search
                  ? "Không tìm thấy"
                  : parentIdSet
                    ? "Bill chính chưa có người chơi — hãy tìm kiếm để chọn thêm"
                    : "Không còn người chơi nào"}
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
              className="btn btn-primary flex-1 sm:flex-none"
            >
              Lưu
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="quick-player-name" className="field-label">
              Tên
            </label>
            <input
              id="quick-player-name"
              type="text"
              value={newPlayer.name}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, name: e.target.value })
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreatePlayer(e);
                }
              }}
              className="field-input"
              placeholder="Nhập tên người chơi"
            />
          </div>
          <div>
            <label htmlFor="quick-player-gender" className="field-label">
              Giới tính
            </label>
            <select
              id="quick-player-gender"
              value={newPlayer.gender}
              onChange={(e) => handleGenderChange(e.target.value)}
              className="field-input"
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
    </div>
  );
}
