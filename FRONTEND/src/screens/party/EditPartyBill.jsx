import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { partyBillsApi, playersApi } from "../../services/api";
import {
  formatCurrency,
  formatCurrencyRounded,
  formatRatio,
} from "../../utils/formatters";
import {
  useGenderDefaultRatios,
  ratioForGender,
} from "../../utils/genderRatio";
import CurrencyInput from "../../components/common/CurrencyInput";
import NumberInput from "../../components/common/NumberInput";
import DatePicker from "../../components/common/DatePicker";

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

export default function EditPartyBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [lockedExtras, setLockedExtras] = useState([]);
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
    extras: [],
    participants: [],
  });

  useEffect(() => {
    loadInitial();
  }, [id]);

  const loadInitial = async () => {
    try {
      setInitialLoading(true);
      const [billRes, playersRes] = await Promise.all([
        partyBillsApi.getById(id),
        playersApi.getAll(),
      ]);
      const bill = billRes.data;
      setPlayers(playersRes.data || []);

      const allPaid =
        (bill.participants?.length || 0) > 0 &&
        bill.participants.every((p) => p.is_paid === true);

      if (allPaid) {
        alert("Không thể sửa bill tiệc đã thanh toán");
        navigate(`/party-bills/${id}`);
        return;
      }

      setForm({
        date: bill.date ? bill.date.slice(0, 10) : todayStr(),
        name: bill.name || "Tiệc",
        note: bill.note || "",
        base_amount: bill.base_amount || 0,
        extras: (bill.extras ?? [])
          .filter((ex) => !ex.car_rental_comparison_id)
          .map((ex) => ({ name: ex.name, amount: ex.amount || 0 })),
        participants: bill.participants
          ? bill.participants.map((p) => ({
              user_id: p.user_id || null,
              name: p.name || "",
              gender: p.user?.gender || null,
              ratio_value: p.ratio_value || 1,
              default_ratio_value: p.ratio_value || 1,
              paid_amount: p.paid_amount || 0,
              food_amount: p.food_amount || 0,
              note: p.note || "",
              is_paid: p.is_paid || false,
            }))
          : [],
      });
      // Dòng do màn Thuê xe sở hữu: hiện chỉ đọc, KHÔNG đưa vào form và
      // KHÔNG gửi lên payload — backend tự giữ chúng.
      setLockedExtras(
        (bill.extras ?? []).filter((ex) => ex.car_rental_comparison_id),
      );
    } catch (error) {
      console.error("Error loading bill for edit", error);
      alert("Không thể tải dữ liệu để sửa");
      navigate("/party-bills");
    } finally {
      setInitialLoading(false);
    }
  };

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

  const lockedExtraTotal = useMemo(
    () =>
      lockedExtras.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [lockedExtras],
  );

  // Dòng do thuê xe sở hữu không nằm trong form nhưng vẫn là tiền thật của
  // bill: phải cộng vào đây, không thì đơn giá và phần chia của từng người
  // hiện ra thấp hơn con số backend tính khi lưu.
  const totalExtra = useMemo(
    () =>
      form.extras.reduce((sum, item) => sum + (Number(item.amount) || 0), 0) +
      lockedExtraTotal,
    [form.extras, lockedExtraTotal],
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
            is_paid: p.is_paid || false,
          })),
      };
      await partyBillsApi.update(id, payload);
      navigate(`/party-bills/${id}`);
    } catch (error) {
      console.error("Error updating party bill", error);
      alert(
        "Lỗi: " +
          (error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Cập nhật chia tiệc thất bại"),
      );
    } finally {
      setSaving(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="px-2 sm:px-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-card">
          Đang tải dữ liệu bill…
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0 pb-24 md:pb-0">
      <header className="mb-5 sm:mb-7">
        <div className="flex items-center justify-between gap-2 sm:block">
          <button
            type="button"
            onClick={() => navigate(`/party-bills/${id}`)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:h-10 sm:px-3 sm:text-sm"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Về chi tiết
          </button>
          <h1 className="font-display min-w-0 truncate text-right text-base font-semibold leading-tight text-slate-900 sm:hidden">
            Sửa Bill tiệc #{id}
          </h1>
        </div>
        <div className="mt-2 hidden min-w-0 sm:block">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-700/80">
            SỬA BILL TIỆC
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold leading-tight text-slate-900">
            Sửa Bill tiệc #{id}
          </h1>
        </div>
      </header>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Main form */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Thông tin cơ bản
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
                  <div className="sm:order-1">
                    <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                      Ngày *
                    </label>
                    <DatePicker
                      value={form.date}
                      onChange={(value) => updateField("date", value)}
                      className="w-full"
                    />
                  </div>
                  <div className="sm:order-3">
                    <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                      Tổng tiền tiệc *
                    </label>
                    <CurrencyInput
                      value={form.base_amount}
                      onChange={(value) => updateField("base_amount", value)}
                      className="w-full"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1 sm:order-2">
                    <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                      Tên/Nội dung *
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => updateField("name", e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      required
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-3 sm:order-4">
                    <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                      Ghi chú
                    </label>
                    <textarea
                      value={form.note}
                      onChange={(e) => updateField("note", e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      rows={1}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Extras */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Chi phí thêm
                </p>
                <button
                  type="button"
                  onClick={addExtra}
                  className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-card transition hover:bg-emerald-700 hover:shadow-card-hover sm:h-10 sm:text-sm"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  Thêm
                </button>
              </div>
              <div className="space-y-2.5 p-4 sm:p-5">
                {form.extras.length === 0 && lockedExtras.length === 0 && (
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
                      placeholder="Tên chi phí"
                      className="col-span-10 h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100 sm:col-span-6 sm:order-1"
                    />
                    <button
                      type="button"
                      onClick={() => removeExtra(idx)}
                      aria-label="Xóa chi phí"
                      className="col-span-2 inline-flex h-10 w-full items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700 sm:col-span-1 sm:order-3"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                      </svg>
                    </button>
                    <div className="col-span-12 sm:col-span-5 sm:order-2">
                      <CurrencyInput
                        value={extra.amount}
                        onChange={(value) => updateExtra(idx, "amount", value)}
                        className="w-full"
                        placeholder="0"
                      />
                    </div>
                  </div>
                ))}
                {lockedExtras.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {lockedExtras.map((extra) => (
                      <div
                        key={extra.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm"
                      >
                        <span className="text-gray-700">
                          🚗 {extra.name}
                          <span className="text-gray-500">
                            {" "}
                            · đến từ màn Thuê xe
                          </span>
                        </span>
                        <span className="font-medium text-gray-900">
                          {formatCurrency(extra.amount)}
                        </span>
                      </div>
                    ))}
                    <div className="text-xs text-gray-500">
                      Sửa các khoản này ở màn Thuê xe. Chúng vẫn được tính vào
                      tổng.
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Participants */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Người tham gia
                </p>
                {form.participants.length > 0 && (
                  <span className="font-tabular text-xs text-slate-500">
                    {form.participants.length} người
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 md:grid-cols-3 md:gap-6">
                <div className="md:col-span-1">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Chọn người
                    </div>
                    <button
                      type="button"
                      onClick={openAddPlayer}
                      className="text-xs font-medium text-emerald-700 hover:text-emerald-800"
                    >
                      + Thêm nhanh
                    </button>
                  </div>
                  <input
                    type="text"
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                    placeholder="Tìm tên..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
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
                          className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left transition hover:border-emerald-200 hover:bg-emerald-50 sm:border-transparent sm:bg-transparent sm:px-3"
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
                  {form.participants.length === 0 ? (
                    <div className="flex h-full min-h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/40 px-4 py-8 text-center text-sm text-slate-500">
                      Chưa có người tham gia.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-1 sm:gap-3">
                      {participantWithShare.map((p, idx) => (
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
                              {p.gender === "female" && (
                                <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700">
                                  Nữ
                                </span>
                              )}
                              {p.gender === "male" && (
                                <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                                  Nam
                                </span>
                              )}
                              {p.is_paid && (
                                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  Đã TT
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-between gap-2 sm:justify-end">
                              <span className="font-display font-tabular text-sm font-semibold text-emerald-700 sm:text-base">
                                {formatCurrencyRounded(p.totalAmount)}
                              </span>
                              {!p.is_paid && (
                                <button
                                  type="button"
                                  onClick={() => removeParticipant(idx)}
                                  aria-label={`Xóa ${p.name}`}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                >
                                  <svg
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    aria-hidden
                                  >
                                    <path d="M18 6L6 18M6 6l12 12" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-4">
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Mức tính
                              </label>
                              <NumberInput
                                value={p.ratio_value}
                                onChange={(value) =>
                                  updateParticipant(idx, "ratio_value", value)
                                }
                                min={0}
                                step={0.1}
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Đã chi
                              </label>
                              <CurrencyInput
                                value={p.paid_amount || 0}
                                onChange={(value) =>
                                  updateParticipant(idx, "paid_amount", value)
                                }
                                className="w-full"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Tiền thêm
                              </label>
                              <CurrencyInput
                                value={p.food_amount || 0}
                                onChange={(value) =>
                                  updateParticipant(idx, "food_amount", value)
                                }
                                className="w-full"
                                placeholder="0"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-[11px] font-medium text-slate-600">
                                Ghi chú
                              </label>
                              <input
                                type="text"
                                value={p.note || ""}
                                onChange={(e) =>
                                  updateParticipant(idx, "note", e.target.value)
                                }
                                className="h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
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

            <div className="hidden sm:flex sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => navigate(`/party-bills/${id}`)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-card transition hover:bg-slate-50 hover:shadow-card-hover"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-6 text-sm font-semibold text-white shadow-card transition hover:bg-amber-700 hover:shadow-card-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <svg
                      className="animate-spin"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M21 12a9 9 0 11-6.219-8.56" />
                    </svg>
                    Đang lưu…
                  </>
                ) : (
                  <>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                    Cập nhật
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
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
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
                    <div className="text-[11px] font-medium uppercase tracking-wider text-emerald-700">
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
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-7xl gap-2">
            <button
              type="button"
              onClick={() => navigate(`/party-bills/${id}`)}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition active:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-amber-600 text-sm font-semibold text-white shadow-card transition active:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Đang lưu…" : "Cập nhật"}
            </button>
          </div>
        </div>
      </form>

      {/* Quick add player modal */}
      {showAddPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4"
          onClick={() => setShowAddPlayer(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-4 p-6">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Thêm nhanh người chơi
              </h3>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                  Tên
                </label>
                <input
                  type="text"
                  value={newPlayer.name}
                  onChange={(e) =>
                    setNewPlayer({ ...newPlayer, name: e.target.value })
                  }
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  placeholder="Tên người chơi"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                    Giới tính
                  </label>
                  <select
                    value={newPlayer.gender}
                    onChange={(e) => handleGenderChange(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                  >
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                    Mức tính
                  </label>
                  <NumberInput
                    value={newPlayer.default_ratio}
                    onChange={(value) =>
                      setNewPlayer({ ...newPlayer, default_ratio: value })
                    }
                    min={0}
                    step={0.1}
                    className="w-full"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddPlayer(false)}
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleCreatePlayer}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                >
                  Lưu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
