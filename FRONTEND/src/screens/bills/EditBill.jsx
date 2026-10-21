import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { billsApi, shuttlesApi, menusApi } from "../../services/api";
import { formatDate, shuttleUnitPrice } from "../../utils/formatters";
import {
  billMenuPrices,
  selectableMenus,
  withBillPrices,
} from "../../utils/menus";
import CurrencyInput from "../../components/common/CurrencyInput";
import NumberInput from "../../components/common/NumberInput";
import DatePicker from "../../components/common/DatePicker";
import PlayerSelector from "../../components/bill/PlayerSelector";
import ShuttleRow from "../../components/bill/ShuttleRow";
import MenuItemPicker from "../../components/bill/MenuItemPicker";
import QuickAddMenu from "../../components/bill/QuickAddMenu";
import BillSummary from "../../components/bill/BillSummary";
import PageHeader from "../../components/ui/PageHeader";
import { Loader, Plus } from "../../components/ui/icons";

export default function EditBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [shuttleTypes, setShuttleTypes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [billPrices, setBillPrices] = useState({});

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    note: "",
    court_total: 0,
    shuttles: [],
    players: [],
    parent_bill_id: null,
  });

  const [preview, setPreview] = useState(null);
  const [shuttleTypesLoading, setShuttleTypesLoading] = useState(false);
  const skipNextShuttleTypesFetchRef = useRef(true);

  /** Tổng số quả theo từng loại trong bill (để tính hoàn tồn khi sửa). */
  const creditByShuttleTypeId = useMemo(() => {
    const m = {};
    formData.shuttles.forEach((s) => {
      if (!s.shuttle_type_id) return;
      const tid = s.shuttle_type_id;
      m[tid] = (m[tid] || 0) + (Number(s.quantity) || 0);
    });
    return m;
  }, [formData.shuttles]);

  const loadInitialData = useCallback(async () => {
    try {
      setInitialLoading(true);
      const billRes = await billsApi.getById(id);
      const bill = billRes.data;
      const billDateStr = bill.date
        ? formatDate(bill.date)
        : new Date().toISOString().split("T")[0];
      const shuttlesRes = await shuttlesApi.getAll({
        params: { as_of: billDateStr },
      });
      const shuttleTypesData = shuttlesRes.data;

      // Map shuttles
      const mappedShuttles = (bill.bill_shuttles || []).map((s) => ({
        shuttle_type_id: s.shuttle_type_id,
        quantity: s.quantity,
        price: s.price_each,
      }));

      // Map players
      const mappedPlayers = (bill.bill_players || []).map((p) => ({
        user_id: p.user_id,
        name: p.user?.name,
        gender: p.user?.gender,
        ratio_value: p.ratio_value,
        default_ratio_value: p.ratio_value ?? 1.0,
        debt_amount: 0,
        debt_date: null,
        include_debt: false,
        menus: (p.bill_player_menus || []).map((m) => ({
          menu_id: m.menu_id,
          name: m.menu?.name,
          price: m.price_each,
          quantity: m.quantity,
          subtotal: m.subtotal,
        })),
      }));

      const newFormData = {
        date: billDateStr,
        note: bill.note || "",
        court_total: bill.court_total || 0,
        shuttles: mappedShuttles,
        players: mappedPlayers,
        parent_bill_id: bill.parent_bill_id || null,
      };

      // Set cả shuttleTypes và formData cùng lúc để tránh race condition
      setShuttleTypes(shuttleTypesData);
      setFormData(newFormData);
      setBillPrices(billMenuPrices(bill.bill_players));

      // Tính preview ngay sau khi có đầy đủ dữ liệu
      if (mappedPlayers.length > 0) {
        // Tính tổng tiền cầu
        const shuttlePrices = mappedShuttles
          .filter((s) => s.shuttle_type_id)
          .map((s) => {
            const type = shuttleTypesData.find(
              (st) => st.id === s.shuttle_type_id,
            );
            const price = shuttleUnitPrice(type) || s.price || 0;
            return {
              price: price,
              quantity: s.quantity || 1,
            };
          });

        const totalShuttlePrice = shuttlePrices.reduce(
          (sum, s) => sum + s.price * s.quantity,
          0,
        );
        const totalAmount = (bill.court_total || 0) + totalShuttlePrice;

        // Tính tổng mức tính
        const sumRatios = mappedPlayers.reduce((sum, p) => {
          const ratio = p.ratio_value ?? p.default_ratio_value ?? 1.0;
          return sum + ratio;
        }, 0);

        // Unit price
        const unitPrice = sumRatios > 0 ? totalAmount / sumRatios : 0;

        // Tính toán cho từng người chơi
        const playersWithAmounts = mappedPlayers.map((player) => {
          const ratioValue =
            player.ratio_value ?? player.default_ratio_value ?? 1.0;
          const shareAmount = Math.round(ratioValue * unitPrice);
          const menuTotal = (player.menus || []).reduce(
            (sum, m) => sum + (m.subtotal || 0),
            0,
          );
          const debtAmount = 0;
          const playerTotalAmount = shareAmount + menuTotal + debtAmount;

          return {
            ...player,
            share_amount: shareAmount,
            menu_extra_total: menuTotal,
            debt_amount: debtAmount,
            total_amount: playerTotalAmount,
          };
        });

        // Tính chênh lệch làm tròn
        const calculatedShareTotal = playersWithAmounts.reduce(
          (sum, p) => sum + p.share_amount,
          0,
        );
        const roundingDifference = totalAmount - calculatedShareTotal;

        setPreview({
          total_shuttle_price: totalShuttlePrice,
          total_amount: totalAmount,
          sum_ratios: sumRatios,
          unit_price: unitPrice,
          players: playersWithAmounts,
          rounding_difference: roundingDifference,
          court_total: bill.court_total || 0,
        });
      } else {
        setPreview(null);
      }
    } catch (error) {
      console.error("Error loading bill for edit:", error);
      alert("Không thể tải dữ liệu bill để sửa");
      navigate("/");
    } finally {
      setInitialLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    skipNextShuttleTypesFetchRef.current = true;
  }, [id]);

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

  /** Menu vừa tạo nhanh -> chèn lên đầu để mọi MenuItemPicker thấy ngay. */
  const handleMenuAdded = (menu) => {
    if (!menu) return;
    setMenus((prev) => [menu, ...prev]);
  };

  /**
   * Ô "Chọn menu" chỉ có món đang bật. Món đã tắt có sẵn trong bill vẫn nằm ở
   * "Menu đã chọn" (lấy từ bill_player_menus), lưu lại không mất.
   * Món đã có trong bill hiện theo giá đã lưu, khớp với giá máy chủ giữ khi lưu.
   */
  const activeMenus = useMemo(
    () => withBillPrices(selectableMenus(menus), billPrices),
    [menus, billPrices],
  );

  /** Khi đổi ngày bill: tải lại giá cầu áp dụng cho ngày đó (lần đầu sau load bill đã có trong loadInitialData). */
  useEffect(() => {
    if (initialLoading) return;
    if (skipNextShuttleTypesFetchRef.current) {
      skipNextShuttleTypesFetchRef.current = false;
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setShuttleTypesLoading(true);
        const res = await shuttlesApi.getAll({
          params: { as_of: formData.date },
        });
        if (!cancelled) setShuttleTypes(res.data);
      } catch (e) {
        console.error("Error loading shuttle types for date:", e);
      } finally {
        if (!cancelled) setShuttleTypesLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [formData.date, initialLoading]);

  const updatePreview = useCallback(() => {
    // Không tính preview nếu chưa có players hoặc đang loading
    if (initialLoading || formData.players.length === 0) {
      if (formData.players.length === 0) {
        setPreview(null);
      }
      return;
    }

    // Tính tổng tiền cầu từ shuttleTypes hoặc từ giá đã lưu trong formData
    const shuttlePrices = formData.shuttles
      .filter((s) => s.shuttle_type_id)
      .map((s) => {
        // Ưu tiên lấy giá từ shuttleTypes nếu có, nếu không thì dùng giá đã lưu trong formData
        const type = shuttleTypes.find((st) => st.id === s.shuttle_type_id);
        const price = shuttleUnitPrice(type) || s.price || 0;
        return {
          price: price,
          quantity: s.quantity || 1,
        };
      });

    // Tính tổng tiền cầu
    const totalShuttlePrice = shuttlePrices.reduce(
      (sum, s) => sum + s.price * s.quantity,
      0,
    );

    // Tổng tiền = tiền sân + tiền cầu
    const totalAmount = Number(formData.court_total || 0) + totalShuttlePrice;

    // Tính tổng mức tính của tất cả người chơi
    const sumRatios = formData.players.reduce((sum, p) => {
      const ratio = Number(p.ratio_value ?? p.default_ratio_value ?? 1.0);
      return sum + ratio;
    }, 0);

    // Unit price = tổng tiền / tổng mức tính
    const unitPrice = sumRatios > 0 ? totalAmount / sumRatios : 0;

    // Tính toán cho từng người chơi
    const playersWithAmounts = formData.players.map((player) => {
      const ratioValue =
        player.ratio_value ?? player.default_ratio_value ?? 1.0;
      const shareAmount = Math.round(ratioValue * unitPrice);
      const menuTotal = (player.menus || []).reduce(
        (sum, m) => sum + (m.subtotal || 0),
        0,
      );
      const debtAmount = 0; // Không tính debt khi edit
      const playerTotalAmount = shareAmount + menuTotal + debtAmount;

      return {
        ...player,
        share_amount: shareAmount,
        menu_extra_total: menuTotal,
        debt_amount: debtAmount,
        total_amount: playerTotalAmount,
      };
    });

    // Tính chênh lệch làm tròn
    const calculatedShareTotal = playersWithAmounts.reduce(
      (sum, p) => sum + p.share_amount,
      0,
    );
    const roundingDifference = totalAmount - calculatedShareTotal;

    setPreview({
      total_shuttle_price: totalShuttlePrice,
      total_amount: totalAmount,
      sum_ratios: sumRatios,
      unit_price: unitPrice,
      players: playersWithAmounts,
      rounding_difference: roundingDifference,
      court_total: formData.court_total,
    });
  }, [formData, shuttleTypes, initialLoading]);

  useEffect(() => {
    // Chỉ update preview khi không phải đang loading ban đầu
    if (!initialLoading) {
      updatePreview();
    }
  }, [updatePreview, initialLoading]);

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

    if (formData.players.length === 0) {
      alert("Vui lòng chọn ít nhất một người chơi");
      return;
    }

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

      const response = await billsApi.update(id, payload);
      navigate(`/bills/${response.data.id}`);
    } catch (error) {
      console.error("Error updating bill:", error);
      alert(
        "Có lỗi xảy ra khi cập nhật bill: " +
          (error.response?.data?.message || error.message),
      );
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="px-2 sm:px-0">
        <div className="mb-6">
          <div className="skeleton h-3 w-24 mb-2" />
          <div className="skeleton h-8 w-56" />
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 sm:gap-6">
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="skeleton h-3 w-28 mb-3" />
              <div className="space-y-3">
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
                <div className="skeleton h-10 w-full" />
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
              <div className="skeleton h-3 w-24 mb-3" />
              <div className="skeleton h-20 w-full" />
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="skeleton h-3 w-20 mb-3" />
            <div className="skeleton h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0 pb-24 md:pb-0">
      <PageHeader
        back={{ to: `/bills/${id}`, label: "Về chi tiết Bill" }}
        title={`Sửa Bill #${id}`}
      />

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            {/* Basic Info and Shuttles */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3">
              {/* Basic Info */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:col-span-1">
                <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    Thông tin cơ bản
                  </h2>
                </div>
                <div className="p-4 sm:p-5">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="bill-date" className="field-label">
                        Ngày đánh *
                      </label>
                      <DatePicker
                        id="bill-date"
                        value={formData.date}
                        onChange={(value) =>
                          setFormData({ ...formData, date: value })
                        }
                        className="field-input"
                      />
                    </div>
                    <div>
                      <label htmlFor="bill-court-total" className="field-label">
                        Tổng tiền sân (VND) *
                      </label>
                      <CurrencyInput
                        id="bill-court-total"
                        value={formData.court_total}
                        onChange={(value) =>
                          setFormData({ ...formData, court_total: value })
                        }
                        baseClassName="field-input"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[140000, 280000, 420000].map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() =>
                              setFormData({ ...formData, court_total: amount })
                            }
                            className={`inline-flex h-11 items-center rounded-lg border px-3 text-sm font-semibold transition sm:h-9 ${
                              Number(formData.court_total) === amount
                                ? "border-emerald-600 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:text-emerald-700"
                            }`}
                          >
                            {amount.toLocaleString("vi-VN")}đ
                          </button>
                        ))}
                        {(() => {
                          const raw = Number(formData.court_total) || 0;
                          const suggestion = raw * 1000;
                          if (
                            raw <= 0 ||
                            raw >= 1000 ||
                            [140000, 280000, 420000].includes(suggestion)
                          )
                            return null;
                          return (
                            <button
                              type="button"
                              onClick={() =>
                                setFormData({
                                  ...formData,
                                  court_total: suggestion,
                                })
                              }
                              className="inline-flex h-11 items-center rounded-lg border border-dashed border-emerald-400 bg-emerald-50 px-3 text-sm font-semibold text-emerald-700 transition hover:border-emerald-500 sm:h-9"
                            >
                              → {suggestion.toLocaleString("vi-VN")}đ
                            </button>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label htmlFor="bill-note" className="field-label">
                        Ghi chú
                      </label>
                      <textarea
                        id="bill-note"
                        value={formData.note}
                        onChange={(e) =>
                          setFormData({ ...formData, note: e.target.value })
                        }
                        className="field-input !h-auto py-2"
                        rows={1}
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Shuttles */}
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:col-span-2">
                <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    Loại cầu
                  </h2>
                  <button
                    type="button"
                    onClick={handleAddShuttle}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus className="h-4 w-4" />
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
                      restoreCredit={
                        shuttle.shuttle_type_id
                          ? creditByShuttleTypeId[shuttle.shuttle_type_id] || 0
                          : 0
                      }
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
                <h2 className="text-base font-semibold text-slate-900">
                  Người chơi
                </h2>
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
                    <div className="mb-3 flex items-center justify-between gap-3 sm:mb-4">
                      <h2 className="text-base font-semibold text-slate-900">
                        Chi tiết người chơi
                      </h2>
                      <QuickAddMenu menus={menus} onCreated={handleMenuAdded} />
                    </div>
                    <div className="space-y-3 sm:space-y-4">
                      {formData.players.map((player, index) => (
                        <article
                          key={index}
                          className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50/60"
                        >
                          <div className="grid grid-cols-1 gap-4 p-3 sm:p-4 md:grid-cols-3 md:gap-6">
                            {/* Player info & ratio */}
                            <div className="md:col-span-1">
                              <div className="mb-3 flex items-start gap-2">
                                <h4 className="min-w-0 break-words text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
                                  {player.name}
                                </h4>
                                {player.gender === "female" && (
                                  <span className="flex-shrink-0 rounded-full bg-pink-100 px-1.5 py-0.5 text-xs font-medium text-pink-700">
                                    Nữ
                                  </span>
                                )}
                                {player.gender === "male" && (
                                  <span className="flex-shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-xs font-medium text-sky-700">
                                    Nam
                                  </span>
                                )}
                              </div>
                              <div>
                                {/* Mobile: label + input on one row. Desktop: stacked. */}
                                <div className="flex items-center justify-between gap-3 sm:block">
                                  <label
                                    htmlFor={`player-ratio-${index}`}
                                    className="text-sm font-medium text-slate-700 sm:mb-1.5 sm:block"
                                  >
                                    Mức tính (override)
                                  </label>
                                  <div className="w-32 sm:w-full">
                                    <NumberInput
                                      id={`player-ratio-${index}`}
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
                                      step={0.01}
                                      className="field-input"
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Menu picker */}
                            <div className="md:col-span-2">
                              <span className="field-label">Menu nước</span>
                              <MenuItemPicker
                                player={player}
                                onUpdate={(updated) =>
                                  handleUpdatePlayer(index, updated)
                                }
                                menus={activeMenus}
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
                onClick={() => navigate(`/bills/${id}`)}
                className="btn btn-secondary"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary px-6"
              >
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
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
                    Lưu thay đổi
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
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
          <div className="mx-auto flex max-w-7xl gap-2">
            <button
              type="button"
              onClick={() => navigate(`/bills/${id}`)}
              className="btn btn-secondary flex-1"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
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
                  Lưu thay đổi
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
