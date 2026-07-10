import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { billsApi, shuttlesApi, menusApi } from "../../services/api";
import {
  calculateBillPreview,
  formatCurrencyRounded,
  formatDate,
  formatRatio,
  shuttleUnitPrice,
} from "../../utils/formatters";
import CurrencyInput from "../../components/common/CurrencyInput";
import NumberInput from "../../components/common/NumberInput";
import DatePicker from "../../components/common/DatePicker";
import PlayerSelector from "../../components/bill/PlayerSelector";
import ShuttleRow from "../../components/bill/ShuttleRow";
import MenuItemPicker from "../../components/bill/MenuItemPicker";
import BillSummary from "../../components/bill/BillSummary";

export default function CreateBill() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const parentBillId = searchParams.get("parent_id");
  const [loading, setLoading] = useState(false);
  const [shuttleTypes, setShuttleTypes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [parentBill, setParentBill] = useState(null);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    note: "",
    court_total: 140000,
    shuttles: [],
    players: [],
    parent_bill_id: parentBillId || null,
  });

  const [preview, setPreview] = useState(null);
  const [shuttleTypesLoading, setShuttleTypesLoading] = useState(true);
  const shuttlesDefaultedRef = useRef(false);

  const loadShuttleTypesForBillDate = async (asOfDate) => {
    try {
      setShuttleTypesLoading(true);
      const response = await shuttlesApi.getAll({
        params: { as_of: asOfDate },
      });
      setShuttleTypes(response.data);
    } catch (error) {
      console.error("Error loading shuttle types:", error);
    } finally {
      setShuttleTypesLoading(false);
    }
  };

  useEffect(() => {
    loadShuttleTypesForBillDate(formData.date);
  }, [formData.date]);

  /** Tải danh sách menu một lần khi mount — tránh N call /api/menus do mỗi MenuItemPicker tự fetch. */
  useEffect(() => {
    let cancelled = false;
    menusApi
      .getAll()
      .then((res) => {
        if (!cancelled) setMenus(res.data || []);
      })
      .catch((e) => console.error("Error loading menus:", e));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (parentBillId) {
      loadParentBill();
    }
  }, [parentBillId]);

  useEffect(() => {
    if (shuttlesDefaultedRef.current || shuttleTypes.length === 0) return;
    const s70Shuttle = shuttleTypes.find((st) => st.name === "Cầu S70");
    shuttlesDefaultedRef.current = true;
    setFormData((prev) => {
      if (prev.shuttles.length > 0) return prev;
      return {
        ...prev,
        shuttles: s70Shuttle
          ? [
              {
                shuttle_type_id: s70Shuttle.id,
                quantity: 12,
                price: shuttleUnitPrice(s70Shuttle),
              },
            ]
          : [],
      };
    });
  }, [shuttleTypes]);

  useEffect(() => {
    updatePreview();
  }, [formData, shuttleTypes]);

  const loadParentBill = async () => {
    try {
      const response = await billsApi.getById(parentBillId);
      setParentBill(response.data);
      // Set date same as parent bill (format to YYYY-MM-DD)
      const parentDate = response.data.date;
      const formattedDate = parentDate
        ? formatDate(parentDate)
        : new Date().toISOString().split("T")[0];
      setFormData((prev) => ({
        ...prev,
        date: formattedDate,
      }));
    } catch (error) {
      console.error("Error loading parent bill:", error);
    }
  };

  const updatePreview = () => {
    // Chỉ cần players để hiển thị preview, shuttles đã có mặc định
    if (formData.players.length === 0) {
      setPreview(null);
      return;
    }

    const previewData = calculateBillPreview(
      formData.court_total,
      formData.shuttles
        .filter((s) => s.shuttle_type_id)
        .map((s) => {
          const type = shuttleTypes.find((st) => st.id === s.shuttle_type_id);
          return {
            price: shuttleUnitPrice(type),
            quantity: s.quantity || 1,
          };
        }),
      formData.players.map((p) => ({
        ...p,
        ratio_value: p.ratio_value ?? p.default_ratio_value ?? 1.0,
        menus: p.menus || [],
        debt_amount: 0,
      })),
    );
    setPreview({
      ...previewData,
      court_total: formData.court_total,
    });
  };

  const handleAddShuttle = () => {
    setFormData({
      ...formData,
      shuttles: [
        ...formData.shuttles,
        { shuttle_type_id: null, quantity: 1, price: 0 },
      ],
    });
  };

  const handleUpdateShuttle = (index, updated) => {
    const newShuttles = [...formData.shuttles];
    newShuttles[index] = updated;
    setFormData({ ...formData, shuttles: newShuttles });
  };

  const handleRemoveShuttle = (index) => {
    setFormData({
      ...formData,
      shuttles: formData.shuttles.filter((_, i) => i !== index),
    });
  };

  const handleSelectPlayer = (player) => {
    setFormData({
      ...formData,
      players: [...formData.players, player],
    });
  };

  const handleRemovePlayer = (index) => {
    setFormData({
      ...formData,
      players: formData.players.filter((_, i) => i !== index),
    });
  };

  const handleUpdatePlayer = (index, updated) => {
    const newPlayers = [...formData.players];
    newPlayers[index] = updated;
    setFormData({ ...formData, players: newPlayers });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation
    if (formData.players.length === 0) {
      alert("Vui lòng chọn ít nhất một người chơi");
      return;
    }

    // Kiểm tra shuttles: cho phép không có loại cầu nếu tổng tiền sân > 0
    const validShuttles = formData.shuttles.filter((s) => s.shuttle_type_id);
    const courtTotal = Number(formData.court_total) || 0;
    if (validShuttles.length === 0 && courtTotal <= 0) {
      alert(
        "Vui lòng thêm ít nhất một loại cầu hợp lệ hoặc nhập tổng tiền sân lớn hơn 0",
      );
      return;
    }

    const sumRatios = formData.players.reduce((sum, p) => {
      const ratio = p.ratio_value ?? p.default_ratio_value ?? 1.0;
      return sum + ratio;
    }, 0);
    if (sumRatios === 0) {
      alert("Tổng mức tính phải lớn hơn 0");
      return;
    }

    try {
      setLoading(true);

      const payload = {
        date: formData.date,
        note: formData.note || null,
        court_total: formData.court_total,
        parent_bill_id: formData.parent_bill_id || null,
        shuttles: formData.shuttles
          .filter((s) => s.shuttle_type_id)
          .map((s) => ({
            shuttle_type_id: s.shuttle_type_id,
            quantity: s.quantity || 1,
          })),
        players: formData.players.map((p) => ({
          user_id: p.user_id,
          ratio_value: p.ratio_value || null,
          menus: (p.menus || []).map((m) => ({
            menu_id: m.menu_id,
            quantity: m.quantity,
          })),
        })),
      };

      const response = await billsApi.create(payload);
      navigate(`/bills/${response.data.id}`);
    } catch (error) {
      console.error("Error creating bill:", error);
      alert(
        "Có lỗi xảy ra khi tạo bill: " +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-2 sm:px-0 pb-24 md:pb-0">
      <header className="mb-5 sm:mb-7">
        {/* Mobile: back + title same row. Desktop: back above, full title block below. */}
        <div className="flex items-center justify-between gap-2 sm:block">
          <button
            type="button"
            onClick={() =>
              navigate(parentBill ? `/bills/${parentBill.id}` : "/")
            }
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
            {parentBill ? "Về Bill chính" : "Danh sách"}
          </button>
          {/* Mobile-only inline title (right side) */}
          <h1 className="font-display min-w-0 truncate text-right text-base font-semibold leading-tight text-slate-900 sm:hidden">
            {parentBill ? `Bill con cho #${parentBill.id}` : "Tạo Bill mới"}
          </h1>
        </div>
        {/* Desktop title block */}
        <div className="mt-2 hidden min-w-0 sm:block">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-emerald-700/80">
            {parentBill ? "TẠO BILL CON" : "TẠO BILL MỚI"}
          </p>
          <h1 className="font-display mt-1 text-3xl font-semibold leading-tight text-slate-900">
            {parentBill
              ? `Tạo Bill con cho Bill #${parentBill.id}`
              : "Tạo Bill mới"}
          </h1>
        </div>
      </header>

      {parentBill && (
        <section className="mb-4 overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-card ring-1 ring-sky-50 sm:mb-6">
          <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">
                Bill chính
              </p>
              <h3 className="font-display mt-0.5 text-base font-semibold text-slate-900 sm:text-lg">
                #{parentBill.id}
              </h3>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 sm:text-sm">
                <span className="inline-flex items-center gap-1.5">
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
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                  {formatDate(parentBill.date)}
                </span>
                <span className="font-tabular font-semibold text-slate-700">
                  {formatCurrencyRounded(parentBill.total_amount)}
                </span>
                <span className="text-slate-500">
                  {parentBill.bill_players?.length || 0} người chơi
                </span>
              </div>
            </div>
          </div>
        </section>
      )}

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            {/* Basic Info and Shuttles */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
              {/* Basic Info */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:col-span-1">
                <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Thông tin cơ bản
                  </p>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-1 sm:gap-4">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                        Ngày đánh *
                      </label>
                      <DatePicker
                        value={formData.date}
                        onChange={(value) =>
                          setFormData({ ...formData, date: value })
                        }
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                        Tổng tiền sân (VND) *
                      </label>
                      <CurrencyInput
                        value={formData.court_total}
                        onChange={(value) =>
                          setFormData({ ...formData, court_total: value })
                        }
                        className="w-full"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[140000, 280000, 420000].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, court_total: amount })
                            }
                            className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
                              Number(formData.court_total) === amount
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600"
                            }`}
                          >
                            {amount.toLocaleString("vi-VN")}đ
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="mb-1 block text-xs font-medium text-slate-700 sm:text-sm">
                        Ghi chú
                      </label>
                      <textarea
                        value={formData.note}
                        onChange={(e) =>
                          setFormData({ ...formData, note: e.target.value })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        rows={1}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Shuttles */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:col-span-2">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Loại cầu
                  </p>
                  <button
                    type="button"
                    onClick={handleAddShuttle}
                    className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-semibold text-white shadow-card transition hover:bg-emerald-700 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:h-10 sm:text-sm"
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
                    Thêm cầu
                  </button>
                </div>
                <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
                  {formData.shuttles.map((shuttle, index) => (
                    <ShuttleRow
                      key={index}
                      shuttle={shuttle}
                      shuttleTypes={shuttleTypes}
                      typesLoading={shuttleTypesLoading}
                      onUpdate={(updated) =>
                        handleUpdateShuttle(index, updated)
                      }
                      onRemove={() => handleRemoveShuttle(index)}
                    />
                  ))}
                </div>
              </section>
            </div>

            {/* Players */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Người chơi
                </p>
                {formData.players.length > 0 && (
                  <span className="font-tabular text-xs text-slate-500">
                    {formData.players.length} người
                  </span>
                )}
              </div>
              <div className="p-4 sm:p-5">
                <PlayerSelector
                  selectedPlayers={formData.players}
                  onSelect={handleSelectPlayer}
                  onRemove={handleRemovePlayer}
                />

                {formData.players.length > 0 && (
                  <div className="mt-5 border-t border-slate-100 pt-5 sm:mt-6 sm:pt-6">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:mb-4">
                      Chi tiết người chơi
                    </p>
                    <div className="space-y-3 sm:space-y-4">
                      {formData.players.map((player, index) => (
                        <article
                          key={index}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60"
                        >
                          <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 md:grid-cols-3 md:gap-6">
                            {/* Player info & ratio */}
                            <div className="md:col-span-1">
                              <div className="mb-3 flex items-center gap-2">
                                <h4 className="truncate font-display text-base font-semibold text-slate-900 sm:text-lg">
                                  {player.name}
                                </h4>
                                {player.gender === "female" && (
                                  <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-[10px] font-semibold text-pink-700">
                                    Nữ
                                  </span>
                                )}
                                {player.gender === "male" && (
                                  <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700">
                                    Nam
                                  </span>
                                )}
                              </div>
                              <div>
                                {/* Mobile: label + input on one row. Desktop: stacked. */}
                                <div className="flex items-center justify-between gap-3 sm:block">
                                  <label className="text-xs font-medium text-slate-700 sm:mb-1 sm:block sm:text-sm">
                                    Mức tính (override)
                                  </label>
                                  <div className="w-32 sm:w-full">
                                    <NumberInput
                                      value={
                                        player.ratio_value ??
                                        player.default_ratio_value ??
                                        1.0
                                      }
                                      onChange={(value) =>
                                        handleUpdatePlayer(index, {
                                          ...player,
                                          ratio_value: value,
                                        })
                                      }
                                      min={0}
                                      step={0.1}
                                      className="w-full"
                                    />
                                  </div>
                                </div>
                                <div className="mt-1 text-[11px] text-slate-500">
                                  Mặc định:{" "}
                                  <span className="font-tabular font-medium text-slate-600">
                                    {formatRatio(
                                      player.default_ratio_value ?? 1.0,
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Menu picker */}
                            <div className="md:col-span-2">
                              <label className="mb-2 block text-xs font-medium text-slate-700 sm:text-sm">
                                Menu nước
                              </label>
                              <MenuItemPicker
                                player={player}
                                onUpdate={(updated) =>
                                  handleUpdatePlayer(index, updated)
                                }
                                menus={menus}
                              />
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* Submit — desktop only (mobile uses fixed footer below) */}
            <div className="hidden sm:flex sm:justify-end sm:gap-3">
              <button
                type="button"
                onClick={() => navigate("/")}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 shadow-card transition hover:bg-slate-50 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white shadow-card transition hover:bg-emerald-700 hover:shadow-card-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
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
                    Đang tạo…
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
                    Tạo Bill
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20">
              <BillSummary preview={preview} />
            </div>
          </div>
        </div>

        {/* Mobile-only fixed footer */}
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-2.5 backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-7xl gap-2">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition active:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-card transition active:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
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
                  Đang tạo…
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
                  Tạo Bill
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
