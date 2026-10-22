import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { partyBillsApi, playersApi } from "../../services/api";
import { formatCurrencyRounded, formatRatio } from "../../utils/formatters";
import {
  useGenderDefaultRatios,
  ratioForGender,
} from "../../utils/genderRatio";
import CurrencyInput from "../../components/common/CurrencyInput";
import NumberInput from "../../components/common/NumberInput";
import DatePicker from "../../components/common/DatePicker";
import PageHeader from "../../components/ui/PageHeader";
import Modal from "../../components/ui/Modal";
import { Check, Loader, Plus, Trash2, X } from "../../components/ui/icons";

const todayStr = () => new Date().toISOString().split("T")[0];

function normalize(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export default function CreatePartyBill() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [showAddPlayer, setShowAddPlayer] = useState(false);
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

  const openAddPlayer = () => {
    setNewPlayer({
      name: "",
      gender: "male",
      default_ratio: ratioForGender(genderRatios, "male"),
    });
    setShowAddPlayer(true);
  };

  const [form, setForm] = useState({
    date: todayStr(),
    name: "Tiệc",
    note: "",
    base_amount: 0,
    extras: [{ name: "Bánh + Tôm", amount: 0 }],
    participants: [],
  });

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      setLoadingPlayers(true);
      const res = await playersApi.getAll();
      setPlayers(res.data || []);
    } catch (error) {
      console.error("Error loading players", error);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateExtra = (index, key, value) => {
    setForm((prev) => {
      const extras = [...prev.extras];
      extras[index] = { ...extras[index], [key]: value };
      return { ...prev, extras };
    });
  };

  const addExtra = () =>
    updateField("extras", [...form.extras, { name: "", amount: 0 }]);
  const removeExtra = (idx) =>
    updateField(
      "extras",
      form.extras.filter((_, i) => i !== idx),
    );

  const updateParticipant = (index, key, value) => {
    setForm((prev) => {
      const participants = [...prev.participants];
      participants[index] = { ...participants[index], [key]: value };
      return { ...prev, participants };
    });
  };

  const removeParticipant = (idx) =>
    updateField(
      "participants",
      form.participants.filter((_, i) => i !== idx),
    );

  const availablePlayers = useMemo(() => {
    const search = normalize(playerSearch);
    return players.filter((p) => {
      const already = form.participants.some((sp) => sp.user_id === p.id);
      if (already) return false;
      if (!search) return true;
      return normalize(p.name).includes(search);
    });
  }, [players, form.participants, playerSearch]);

  const handleSelectPlayer = (player) => {
    updateField("participants", [
      ...form.participants,
      {
        user_id: player.id,
        name: player.name,
        gender: player.gender,
        ratio_value: 1,
        default_ratio_value:
          player.default_ratio_value ?? player.default_ratio ?? 1,
        paid_amount: 0,
        food_amount: 0,
        note: "",
      },
    ]);
  };

  const handleCreatePlayer = async () => {
    if (!newPlayer.name.trim()) {
      alert("Nhập tên người chơi");
      return;
    }
    const slug = newPlayer.name.trim().toLowerCase().replace(/\s+/g, "");
    const email = `${slug || "player"}${Date.now()}@party.local`;
    try {
      const payload = {
        name: newPlayer.name.trim(),
        gender: newPlayer.gender,
        default_ratio: newPlayer.default_ratio || 1,
        email,
        password: "password",
      };
      const res = await playersApi.create(payload);
      await loadPlayers();
      setShowAddPlayer(false);
      setNewPlayer({ name: "", gender: "male", default_ratio: 1 });
      handleSelectPlayer({
        id: res.data.id,
        name: res.data.name,
        gender: res.data.gender,
      });
    } catch (error) {
      console.error("Create player error", error);
      alert("Không thể tạo người chơi mới");
    }
  };

  const totalExtra = useMemo(
    () =>
      form.extras.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [form.extras],
  );

  const sumRatios = useMemo(
    () =>
      form.participants.reduce(
        (sum, p) => sum + (Number(p.ratio_value) || 0),
        0,
      ),
    [form.participants],
  );

  const unitPrice = useMemo(() => {
    const base = Number(form.base_amount) || 0;
    return sumRatios > 0 ? Math.round((base + totalExtra) / sumRatios) : 0;
  }, [form.base_amount, sumRatios, totalExtra]);

  const participantWithShare = useMemo(() => {
    return form.participants.map((p) => {
      const ratio = Number(p.ratio_value) || 0;
      const share = Math.round(ratio * unitPrice);
      const paidAmount = Number(p.paid_amount) || 0;
      const foodAmount = Number(p.food_amount) || 0;
      const totalAmount = share + foodAmount - paidAmount;
      return { ...p, share, totalAmount };
    });
  }, [form.participants, unitPrice]);

  const totalAll = (Number(form.base_amount) || 0) + totalExtra;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert("Vui lòng nhập tên/nội dung tiệc");
      return;
    }
    if (form.participants.length === 0) {
      alert("Vui lòng nhập ít nhất 1 người");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        date: form.date,
        name: form.name,
        note: form.note,
        base_amount: Number(form.base_amount) || 0,
        extras: form.extras
          .filter((x) => (x.name || "") !== "" && Number(x.amount) > 0)
          .map((x) => ({ name: x.name, amount: Number(x.amount) || 0 })),
        participants: form.participants
          .filter((p) => (p.name || "") !== "")
          .map((p) => ({
            user_id: p.user_id || null,
            name: p.name,
            ratio_value: Number(p.ratio_value) || 0,
            paid_amount: Number(p.paid_amount) || 0,
            food_amount: Number(p.food_amount) || 0,
            note: p.note || "",
            is_paid: false,
          })),
      };
      const res = await partyBillsApi.create(payload);
      navigate(`/party-bills/${res.data.id}`);
    } catch (error) {
      console.error("Error creating party bill", error);
      alert(
        "Lỗi: " +
          (error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Tạo chia tiệc thất bại"),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pb-24 sm:px-0 md:pb-0">
      <PageHeader
        back={{ to: "/party-bills", label: "Danh sách" }}
        title="Tạo Bill tiệc mới"
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Main form */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            {/* Basic info */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-sm font-semibold text-slate-900">
                  Thông tin cơ bản
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="sm:order-1">
                    <label htmlFor="pbc-date" className="field-label">
                      Ngày *
                    </label>
                    <DatePicker
                      id="pbc-date"
                      value={form.date}
                      onChange={(value) => updateField("date", value)}
                      baseClassName="field-input"
                    />
                  </div>
                  <div className="sm:order-3">
                    <label htmlFor="pbc-base" className="field-label">
                      Tổng tiền tiệc *
                    </label>
                    <CurrencyInput
                      id="pbc-base"
                      value={form.base_amount}
                      onChange={(value) => updateField("base_amount", value)}
                      baseClassName="field-input"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 sm:order-2">
                    <label htmlFor="pbc-name" className="field-label">
                      Tên/Nội dung *
                    </label>
                    <input
                      id="pbc-name"
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      className="field-input"
                      placeholder="Tiệc sinh nhật..."
                      required
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-3 sm:order-4">
                    <label htmlFor="pbc-note" className="field-label">
                      Ghi chú
                    </label>
                    <textarea
                      id="pbc-note"
                      value={form.note}
                      onChange={(e) => updateField("note", e.target.value)}
                      className="field-input !h-auto py-2"
                      rows={1}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Extras */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-sm font-semibold text-slate-900">
                  Chi phí thêm
                </p>
                <button
                  type="button"
                  onClick={addExtra}
                  className="btn btn-primary btn-sm"
                >
                  <Plus className="h-4 w-4" />
                  Thêm
                </button>
              </div>
              <div className="space-y-2.5 p-4 sm:p-5">
                {form.extras.length === 0 && (
                  <p className="text-xs text-slate-500">
                    Chưa có chi phí phụ. Bấm "Thêm" để thêm.
                  </p>
                )}
                {form.extras.map((extra, idx) => (
                  <div
                    key={idx}
                    className="grid grid-cols-12 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 p-2.5"
                  >
                    <input
                      type="text"
                      value={extra.name}
                      onChange={(e) => updateExtra(idx, "name", e.target.value)}
                      placeholder="Tên chi phí (ví dụ: Bánh kem)"
                      aria-label={`Tên chi phí ${idx + 1}`}
                      className="field-input col-span-10 sm:col-span-6 sm:order-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeExtra(idx)}
                      aria-label="Xóa chi phí"
                      className="btn btn-danger-soft btn-icon col-span-2 w-full sm:col-span-1 sm:order-3"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <div className="col-span-12 sm:col-span-5 sm:order-2">
                      <CurrencyInput
                        value={extra.amount}
                        onChange={(value) => updateExtra(idx, "amount", value)}
                        baseClassName="field-input"
                        aria-label={`Số tiền chi phí ${idx + 1}`}
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Participants */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-sm font-semibold text-slate-900">
                  Người tham gia
                </p>
                {form.participants.length > 0 && (
                  <span className="font-tabular text-xs text-slate-500">
                    {form.participants.length} người
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-3 md:gap-6">
                {/* Player picker */}
                <div className="md:col-span-1">
                  <div className="flex items-center justify-between mb-2">
                    <label
                      htmlFor="pbc-search"
                      className="text-sm font-medium text-slate-700"
                    >
                      Chọn người
                    </label>
                    <button
                      type="button"
                      onClick={openAddPlayer}
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
                          onClick={() => handleSelectPlayer(p)}
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

                {/* Selected participants */}
                <div className="md:col-span-2">
                  {form.participants.length === 0 ? (
                    <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-4 py-8 text-center text-sm text-slate-500">
                      Chọn người chơi từ danh sách bên trái để bắt đầu chia
                      tiền.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3">
                      {participantWithShare.map((p, idx) => (
                        <article
                          key={idx}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60"
                        >
                          <div className="flex flex-col gap-1.5 border-b border-slate-100 bg-white px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                            <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                              <h4 className="min-w-0 truncate font-display text-sm font-semibold text-slate-900 sm:text-base">
                                {p.name}
                              </h4>
                              {p.gender === "female" && (
                                <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
                                  Nữ
                                </span>
                              )}
                              {p.gender === "male" && (
                                <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-700">
                                  Nam
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                              <span className="font-display font-tabular text-sm font-semibold text-emerald-700 sm:text-base">
                                {formatCurrencyRounded(p.totalAmount)}
                              </span>
                              <button
                                type="button"
                                onClick={() => removeParticipant(idx)}
                                aria-label={`Xóa ${p.name}`}
                                className="-my-1 inline-flex h-11 w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 sm:h-9 sm:w-9"
                              >
                                <X className="h-4 w-4" />
                              </button>
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
                                  updateParticipant(idx, "ratio_value", value)
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
                                  updateParticipant(idx, "paid_amount", value)
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
                                  updateParticipant(idx, "food_amount", value)
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
                                onChange={(e) =>
                                  updateParticipant(idx, "note", e.target.value)
                                }
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
            </section>

            {/* Desktop submit */}
            <div className="hidden sm:flex sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => navigate("/party-bills")}
                className="btn btn-secondary px-5"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn btn-primary px-6"
              >
                {saving ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Đang lưu…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Tạo Bill tiệc
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20 space-y-4">
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
                <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                  <p className="text-sm font-semibold text-emerald-700">
                    Tổng kết
                  </p>
                </div>
                <div className="space-y-3 p-4 sm:p-5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">
                      Tổng tiền tiệc
                    </span>
                    <span className="font-tabular text-sm font-semibold text-slate-900">
                      {formatCurrencyRounded(Number(form.base_amount) || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">
                      Tổng chi phí thêm
                    </span>
                    <span className="font-tabular text-sm font-semibold text-slate-900">
                      {formatCurrencyRounded(totalExtra)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-xs text-slate-600">SUM mức tính</span>
                    <span className="font-tabular text-sm font-semibold text-slate-900">
                      {sumRatios}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-600">
                      Đơn giá / mức
                    </span>
                    <span className="font-tabular text-sm font-semibold text-slate-900">
                      {formatCurrencyRounded(unitPrice)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-emerald-50/70 p-3">
                    <div className="text-xs font-medium text-emerald-700">
                      Tổng cộng
                    </div>
                    <div className="font-display font-tabular mt-1 text-2xl font-semibold text-emerald-700">
                      {formatCurrencyRounded(totalAll)}
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>

        {/* Mobile sticky footer */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/90 px-4 pb-[calc(0.625rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-7xl gap-2">
            <button
              type="button"
              onClick={() => navigate("/party-bills")}
              className="btn btn-secondary flex-1"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary flex-1"
            >
              {saving ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Đang lưu…
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Tạo
                </>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Quick add player modal */}
      <Modal
        isOpen={showAddPlayer}
        onClose={() => setShowAddPlayer(false)}
        title="Thêm nhanh người chơi"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddPlayer(false)}
              className="btn btn-secondary"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleCreatePlayer}
              className="btn btn-primary"
            >
              Lưu
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="pbc-np-name" className="field-label">
              Tên
            </label>
            <input
              id="pbc-np-name"
              type="text"
              value={newPlayer.name}
              onChange={(e) =>
                setNewPlayer({ ...newPlayer, name: e.target.value })
              }
              className="field-input"
              placeholder="Tên người chơi"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="pbc-np-gender" className="field-label">
                Giới tính
              </label>
              <select
                id="pbc-np-gender"
                value={newPlayer.gender}
                onChange={(e) => handleGenderChange(e.target.value)}
                className="field-input"
              >
                <option value="male">Nam</option>
                <option value="female">Nữ</option>
              </select>
            </div>
            <div>
              <label htmlFor="pbc-np-ratio" className="field-label">
                Mức tính
              </label>
              <NumberInput
                id="pbc-np-ratio"
                value={newPlayer.default_ratio}
                onChange={(value) =>
                  setNewPlayer({ ...newPlayer, default_ratio: value })
                }
                min={0}
                step={0.1}
                baseClassName="field-input"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
