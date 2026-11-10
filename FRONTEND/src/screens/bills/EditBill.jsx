import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { billsApi, shuttlesApi, menusApi } from "../../services/api";
import { formatDate, shuttleUnitPrice } from "../../utils/formatters";
import {
  billMenuPrices,
  playerExtraTotal,
  selectableMenus,
  withBillPrices,
} from "../../utils/menus";
import {
  billFormErrorList,
  serverErrorMessage,
  validateBillForm,
} from "../../utils/billFormErrors";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import BillSummary from "../../components/bill/BillSummary";
import BillPlayersSection from "../../components/bill/BillPlayersSection";
import {
  BillActionBar,
  BillBasicInfoCard,
  BillShuttlesCard,
} from "../../components/bill/BillFormSections";
import {
  focusField,
  focusNextOnEnter,
} from "../../components/bill/billFormFocus";
import useConfirmLeave from "../../components/bill/useConfirmLeave";
import MatchBillForm from "../../components/bill/MatchBillForm";
import {
  SPLIT_MATCH,
  matchCandidates,
  matchFormFromBill,
} from "../../utils/matchBill";
import ActionBar from "../../components/ui/ActionBar";
import AppBar from "../../components/ui/AppBar";
import EmptyState from "../../components/ui/EmptyState";
import PageHeader from "../../components/ui/PageHeader";
import useToast from "../../components/ui/useToast";
import { Check, CircleAlert, Loader } from "../../components/ui/icons";

const FORM_ID = "bill-form";

/** Bill con: ghi chú chính là nhãn dòng bill sau trong khối "TT + Bill sau" của bill chính. */
const CHILD_NOTE_HINT = 'Ghi chú hiện ở dòng "TT + Bill sau" của bill chính.';

/** Lưu bill giữ Đã TT của người còn trong bill (BillController::update) — báo để biết tiền đổi cũng không bỏ dấu. */
function PaidNotice({ count }) {
  if (count === 0) return null;
  return (
    <div
      role="note"
      className="mb-4 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 sm:mb-6"
    >
      <CircleAlert className="mt-0.5 h-4 w-4 flex-none text-amber-600" />
      <p>
        <span className="font-semibold">{count} người đã TT trong bill này.</span>{" "}
        Lưu thay đổi vẫn giữ Đã TT cho người còn trong bill, kể cả khi số tiền thay đổi.
      </p>
    </div>
  );
}

/**
 * Xem trước khi sửa: giá cầu theo ngày bill (thiếu thì giá đã lưu), không tính nợ. Tính cả
 * khi chưa có người để thanh đáy luôn có tổng tiền.
 */
const buildEditPreview = (formData, shuttleTypes) => {
  // Tính tổng tiền cầu từ shuttleTypes hoặc từ giá đã lưu trong formData
  const shuttlePrices = formData.shuttles
    .filter((s) => s.shuttle_type_id)
    .map((s) => {
      // Ưu tiên lấy giá từ shuttleTypes nếu có, nếu không thì dùng giá đã lưu trong formData
      const type = shuttleTypes.find((st) => st.id === s.shuttle_type_id);
      const price = shuttleUnitPrice(type) || s.price || 0;
      return {
        price: price,
        quantity: Number(s.quantity) || 0,
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
    const ratioValue = player.ratio_value ?? player.default_ratio_value ?? 1.0;
    const shareAmount = Math.round(ratioValue * unitPrice);
    const menuTotal = playerExtraTotal(player);
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

  return {
    total_shuttle_price: totalShuttlePrice,
    total_amount: totalAmount,
    sum_ratios: sumRatios,
    unit_price: unitPrice,
    players: playersWithAmounts,
    rounding_difference: roundingDifference,
    court_total: formData.court_total,
  };
};

/**
 * Nơi về khi lưu xong / bấm quay lại: bill chính nếu mở từ nút "Sửa bill con" ở chi tiết bill
 * chính (location.state.returnTo), không thì chi tiết chính bill đang sửa.
 */
const returnPathOf = (state, id) =>
  typeof state?.returnTo === "string" && state.returnTo.startsWith("/bills/")
    ? state.returnTo
    : `/bills/${id}`;

/** Khung xương khi đang tải (desktop như cũ; điện thoại có thanh trên + thanh đáy mờ). */
function EditBillSkeleton({ id }) {
  return (
    <div className="px-4 sm:px-0">
      <AppBar
        back={{ to: `/bills/${id}`, label: "Về chi tiết Bill" }}
        title={`Sửa Bill #${id}`}
      />
      <div className="mb-6 hidden sm:block">
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
      <ActionBar summary={{ label: "Tổng tiền", value: "—" }}>
        <button type="button" disabled className="btn btn-primary flex-1">
          <Check className="h-4 w-4" strokeWidth={2.5} />
          Lưu thay đổi
        </button>
      </ActionBar>
    </div>
  );
}

export default function EditBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const backTo = returnPathOf(location.state, id);
  const backLabel =
    backTo === `/bills/${id}` ? "Về chi tiết Bill" : "Về Bill chính";
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [shuttleTypes, setShuttleTypes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [billPrices, setBillPrices] = useState({});
  // Bill chia theo trận: { bill, candidates } — sửa bằng MatchBillForm thay cho form mức tính
  const [matchBill, setMatchBill] = useState(null);
  // Người dùng đã sửa gì chưa (để hỏi lại khi rời màn); đã bấm lưu lần nào chưa (để hiện lỗi M14)
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    note: "",
    court_total: 0,
    shuttles: [],
    players: [],
    parent_bill_id: null,
  });

  const [shuttleTypesLoading, setShuttleTypesLoading] = useState(false);
  const skipNextShuttleTypesFetchRef = useRef(true);

  /** Thay đổi do người dùng: cập nhật theo state mới nhất (chọn nhiều người một lúc). */
  const updateForm = (updater) => {
    setTouched(true);
    setFormData(updater);
  };

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
      setLoadFailed(false);
      const billRes = await billsApi.getById(id);
      const bill = billRes.data;
      if (bill.split_mode === SPLIT_MATCH) {
        const parent = bill.parent_bill_id
          ? (await billsApi.getById(bill.parent_bill_id)).data
          : null;
        setMatchBill({
          bill,
          candidates: matchCandidates(parent?.bill_players, bill.matches),
        });
        return;
      }
      setMatchBill(null);
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

      // Map players (is_paid chỉ để hiện "Đã TT" và dải cảnh báo, không gửi lên máy chủ)
      const mappedPlayers = (bill.bill_players || []).map((p) => ({
        user_id: p.user_id,
        name: p.user?.name,
        gender: p.user?.gender,
        ratio_value: p.ratio_value,
        default_ratio_value: p.ratio_value ?? 1.0,
        debt_amount: 0,
        debt_date: null,
        include_debt: false,
        is_paid: Boolean(p.is_paid),
        extra_amount: p.extra_amount || 0,
        extra_note: p.extra_note || "",
        menus: (p.bill_player_menus || []).map((m) => ({
          menu_id: m.menu_id,
          name: m.menu?.name,
          price: m.price_each,
          quantity: m.quantity,
          subtotal: m.subtotal,
        })),
      }));

      // Set cả shuttleTypes và formData cùng lúc để tránh race condition
      setShuttleTypes(shuttleTypesData);
      setFormData({
        date: billDateStr,
        note: bill.note || "",
        court_total: bill.court_total || 0,
        shuttles: mappedShuttles,
        players: mappedPlayers,
        parent_bill_id: bill.parent_bill_id || null,
      });
      setBillPrices(billMenuPrices(bill.bill_players));
      setTouched(false);
    } catch (error) {
      console.error("Error loading bill for edit:", error);
      setLoadFailed(true);
    } finally {
      setInitialLoading(false);
    }
  }, [id]);

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

  const fullPreview = useMemo(
    () => buildEditPreview(formData, shuttleTypes),
    [formData, shuttleTypes],
  );
  const preview = formData.players.length > 0 ? fullPreview : null;

  const errors = useMemo(
    () => (submitted ? validateBillForm(formData) : null),
    [submitted, formData],
  );

  const handleChange = (patch) => updateForm((prev) => ({ ...prev, ...patch }));

  const handleAddShuttle = () => {
    updateForm((prev) => ({
      ...prev,
      shuttles: [
        ...prev.shuttles,
        { shuttle_type_id: null, quantity: 1, price: 0 },
      ],
    }));
  };

  const handleUpdateShuttle = (index, updated) => {
    updateForm((prev) => ({
      ...prev,
      shuttles: prev.shuttles.map((s, i) => (i === index ? updated : s)),
    }));
  };

  const handleRemoveShuttle = (index) => {
    updateForm((prev) => ({
      ...prev,
      shuttles: prev.shuttles.filter((_, i) => i !== index),
    }));
  };

  const handleSelectPlayer = (player) => {
    updateForm((prev) =>
      prev.players.some((p) => p.user_id === player.user_id)
        ? prev
        : { ...prev, players: [...prev.players, player] },
    );
  };

  const handleRemovePlayer = (index) => {
    updateForm((prev) => ({
      ...prev,
      players: prev.players.filter((_, i) => i !== index),
    }));
  };

  const handleUpdatePlayer = (index, updated) => {
    updateForm((prev) => ({
      ...prev,
      players: prev.players.map((p, i) => (i === index ? updated : p)),
    }));
  };

  const save = async () => {
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
          extra_amount: Number(p.extra_amount) || 0,
          extra_note: (p.extra_note || "").trim() || null,
          menus: (p.menus || []).map((m) => ({
            menu_id: m.menu_id,
            quantity: m.quantity,
          })),
        })),
      };

      await billsApi.update(id, payload);
      navigate(backTo);
    } catch (error) {
      console.error("Error updating bill:", error);
      toast.error(
        "Có lỗi xảy ra khi cập nhật bill: " + serverErrorMessage(error),
        { onRetry: () => document.getElementById(FORM_ID)?.requestSubmit() },
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;

    // Kiểm hết rồi báo ngay dưới ô sai (M14), cuộn tới và đặt con trỏ vào ô sai đầu tiên
    setSubmitted(true);
    const errorList = billFormErrorList(validateBillForm(formData));
    if (errorList.length > 0) {
      focusField(errorList[0].field);
      return;
    }
    save();
  };

  const leave = useConfirmLeave({ when: touched && !loading, backTo });

  if (initialLoading) return <EditBillSkeleton id={id} />;

  if (loadFailed) {
    return (
      <div className="px-4 sm:px-0">
        <PageHeader
          back={{ to: backTo, label: backLabel }}
          title={`Sửa Bill #${id}`}
        />
        <EmptyState
          tone="error"
          title="Không thể tải dữ liệu bill để sửa"
          onRetry={loadInitialData}
        />
      </div>
    );
  }

  const renderHeader = (onBackClick) => (
    <PageHeader
      back={{ to: backTo, label: backLabel, onClick: onBackClick }}
      title={`Sửa Bill #${id}`}
    />
  );

  if (matchBill) {
    const { bill } = matchBill;
    return (
      <div className="px-4 sm:px-0">
        <MatchBillForm
          header={renderHeader}
          intro={
            <PaidNotice
              count={(bill.bill_players || []).filter((p) => p.is_paid).length}
            />
          }
          initialForm={matchFormFromBill(bill)}
          candidates={matchBill.candidates}
          // Bill chính: sheet chọn người hiện mọi người chơi; bill con: người của bill chính
          scopeToCandidates={Boolean(bill.parent_bill_id)}
          backTo={backTo}
          onSave={async (payload) => {
            await billsApi.update(id, payload);
            navigate(backTo);
          }}
          submitLabel="Lưu thay đổi"
          busyLabel="Đang lưu…"
          errorPrefix="Có lỗi xảy ra khi cập nhật bill"
          leave={{
            title: "Bỏ thay đổi?",
            message: "Các thay đổi chưa lưu sẽ mất.",
            confirmLabel: "Bỏ thay đổi",
          }}
          noteHint={bill.parent_bill_id ? CHILD_NOTE_HINT : undefined}
          courtCalculator={Boolean(bill.parent_bill_id)}
        />
      </div>
    );
  }

  const paidCount = formData.players.filter((p) => p.is_paid).length;

  return (
    <div className="px-4 sm:px-0">
      {renderHeader(leave.onBackClick)}
      <PaidNotice count={paidCount} />

      <form id={FORM_ID} onSubmit={handleSubmit} onKeyDown={focusNextOnEnter}>
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Main Form */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            {/* Basic Info and Shuttles */}
            <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-3 md:items-start">
              <BillBasicInfoCard
                formData={formData}
                onChange={handleChange}
                courtError={errors?.court}
                noteHint={formData.parent_bill_id ? CHILD_NOTE_HINT : undefined}
                courtCalculator={Boolean(formData.parent_bill_id)}
              />
              <BillShuttlesCard
                shuttles={formData.shuttles}
                shuttleTypes={shuttleTypes}
                typesLoading={shuttleTypesLoading}
                quantityErrors={errors?.shuttleQuantity}
                restoreCreditFor={(shuttle) =>
                  shuttle.shuttle_type_id
                    ? creditByShuttleTypeId[shuttle.shuttle_type_id] || 0
                    : 0
                }
                onAdd={handleAddShuttle}
                onUpdate={handleUpdateShuttle}
                onRemove={handleRemoveShuttle}
              />
            </div>

            <BillPlayersSection
              players={formData.players}
              previewPlayers={fullPreview.players}
              menus={activeMenus}
              allMenus={menus}
              onMenuAdded={handleMenuAdded}
              onSelect={handleSelectPlayer}
              onRemove={handleRemovePlayer}
              onUpdate={handleUpdatePlayer}
              error={errors?.players}
            />

            {/* Submit — desktop only (mobile uses ActionBar below) */}
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
                {loading ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    Đang lưu…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    Lưu thay đổi
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Summary Sidebar — điện thoại xem qua sheet Tóm tắt Bill ở thanh đáy */}
          <div className="hidden sm:block lg:col-span-1">
            <div className="lg:sticky lg:top-20">
              <BillSummary preview={preview} />
            </div>
          </div>
        </div>
      </form>

      <BillActionBar
        formId={FORM_ID}
        preview={fullPreview}
        playerCount={formData.players.length}
        loading={loading}
        label="Lưu thay đổi"
        busyLabel="Đang lưu…"
      />

      <ConfirmDialog
        isOpen={leave.isOpen}
        onClose={leave.cancel}
        onConfirm={leave.confirm}
        title="Bỏ thay đổi?"
        message="Các thay đổi chưa lưu sẽ mất."
        confirmLabel="Bỏ thay đổi"
      />
    </div>
  );
}
