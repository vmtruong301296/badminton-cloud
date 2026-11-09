import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { billsApi, shuttlesApi, menusApi } from "../../services/api";
import {
  calculateBillPreview,
  formatCurrencyRounded,
  formatDate,
  formatDateShort,
  shuttleUnitPrice,
} from "../../utils/formatters";
import { selectableMenus } from "../../utils/menus";
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
import MatchBillForm, {
  SplitModeSwitch,
} from "../../components/bill/MatchBillForm";
import {
  SPLIT_MATCH,
  SPLIT_RATIO,
  matchCandidates,
} from "../../utils/matchBill";
import PageHeader from "../../components/ui/PageHeader";
import useToast from "../../components/ui/useToast";
import { CalendarDays, Check, Loader } from "../../components/ui/icons";

const FORM_ID = "bill-form";

const DEFAULT_COURT_TOTAL = 280000;

/** Loại cầu điền sẵn khi tạo bill mới, khớp theo tên trong bảng shuttle_types. */
const DEFAULT_SHUTTLES = [
  { name: "Cầu S70", quantity: 12 },
  { name: "Cầu Thành Công", quantity: 12 },
];

/** Bill con chia theo mức tính: điền sẵn 1 quả Cầu S70. */
const CHILD_DEFAULT_SHUTTLES = [{ name: "Cầu S70", quantity: 1 }];

/** Bill con: ghi chú chính là nhãn dòng bill sau trong khối "TT + Bill sau" của bill chính. */
const CHILD_NOTE_HINT = 'Ghi chú hiện ở dòng "TT + Bill sau" của bill chính.';

export default function CreateBill() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const parentBillId = searchParams.get("parent_id");
  const [loading, setLoading] = useState(false);
  const [shuttleTypes, setShuttleTypes] = useState([]);
  const [menus, setMenus] = useState([]);
  const [parentBill, setParentBill] = useState(null);
  // Cách chia tiền: bill con mặc định theo trận, bill chính mặc định theo mức tính
  const [splitMode, setSplitMode] = useState(() =>
    parentBillId ? SPLIT_MATCH : SPLIT_RATIO,
  );
  // Người dùng đã sửa gì chưa (để hỏi lại khi rời màn); đã bấm lưu lần nào chưa (để hiện lỗi M14)
  const [touched, setTouched] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    note: "",
    // Bill con để trống tiền sân cho người dùng tự nhập
    court_total: parentBillId ? null : DEFAULT_COURT_TOTAL,
    shuttles: [],
    players: [],
    parent_bill_id: parentBillId || null,
  });

  const [shuttleTypesLoading, setShuttleTypesLoading] = useState(true);
  const shuttlesDefaultedRef = useRef(false);

  /** Thay đổi do người dùng: cập nhật theo state mới nhất (chọn nhiều người một lúc). */
  const updateForm = (updater) => {
    setTouched(true);
    setFormData(updater);
  };

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

  /** Menu vừa tạo nhanh -> chèn lên đầu để mọi MenuItemPicker thấy ngay. */
  const handleMenuAdded = (menu) => {
    if (!menu) return;
    setMenus((prev) => [menu, ...prev]);
  };

  /** Ô "Chọn menu" chỉ có món đang bật; QuickAddMenu vẫn nhận đủ để chặn trùng tên. */
  const activeMenus = useMemo(() => selectableMenus(menus), [menus]);

  useEffect(() => {
    if (!parentBillId) return;
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
    loadParentBill();
  }, [parentBillId]);

  useEffect(() => {
    if (shuttlesDefaultedRef.current || shuttleTypes.length === 0) return;
    const defaults = parentBillId ? CHILD_DEFAULT_SHUTTLES : DEFAULT_SHUTTLES;
    const defaultShuttles = defaults.flatMap(({ name, quantity }) => {
      const type = shuttleTypes.find((st) => st.name === name);
      return type
        ? [
            {
              shuttle_type_id: type.id,
              quantity,
              price: shuttleUnitPrice(type),
            },
          ]
        : [];
    });
    shuttlesDefaultedRef.current = true;
    setFormData((prev) => {
      if (prev.shuttles.length > 0) return prev;
      return { ...prev, shuttles: defaultShuttles };
    });
  }, [shuttleTypes, parentBillId]);

  /**
   * Xem trước (calculateBillPreview). Tính cả khi chưa có người để thanh đáy luôn có tổng
   * tiền; cột Tóm tắt desktop vẫn chỉ hiện khi đã có người như trước.
   */
  const fullPreview = useMemo(() => {
    const previewData = calculateBillPreview(
      Number(formData.court_total) || 0,
      formData.shuttles
        .filter((s) => s.shuttle_type_id)
        .map((s) => {
          const type = shuttleTypes.find((st) => st.id === s.shuttle_type_id);
          return {
            price: shuttleUnitPrice(type),
            quantity: Number(s.quantity) || 0,
          };
        }),
      formData.players.map((p) => ({
        ...p,
        ratio_value: p.ratio_value ?? p.default_ratio_value ?? 1.0,
        menus: p.menus || [],
        debt_amount: 0,
      })),
    );
    return { ...previewData, court_total: formData.court_total };
  }, [formData, shuttleTypes]);
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

      const response = await billsApi.create(payload);
      navigate(`/bills/${response.data.id}`);
    } catch (error) {
      console.error("Error creating bill:", error);
      toast.error("Có lỗi xảy ra khi tạo bill: " + serverErrorMessage(error), {
        onRetry: () => document.getElementById(FORM_ID)?.requestSubmit(),
      });
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

  const backTo = parentBill ? `/bills/${parentBill.id}` : "/";
  const leave = useConfirmLeave({ when: touched && !loading, backTo });
  const playerCount = formData.players.length;
  const isChildBill = Boolean(parentBillId);

  const matchPlayerCandidates = useMemo(
    () => matchCandidates(parentBill?.bill_players),
    [parentBill],
  );

  const renderHeader = (onBackClick) => (
    <PageHeader
      back={{
        to: backTo,
        label: parentBill ? "Về Bill chính" : "Danh sách",
        onClick: onBackClick,
      }}
      title={
        <>
          <span className="sm:hidden">
            {parentBill ? `Bill con cho #${parentBill.id}` : "Tạo Bill mới"}
          </span>
          <span className="hidden sm:inline">
            {parentBill
              ? `Tạo Bill con cho Bill #${parentBill.id}`
              : "Tạo Bill mới"}
          </span>
        </>
      }
    />
  );

  const parentCard = parentBill && (
    <section className="mb-4 overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-card ring-1 ring-sky-50 sm:mb-6">
      <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-sky-700">Bill chính</p>
          <h2 className="mt-0.5 text-base font-semibold tracking-tight text-slate-900 sm:text-lg">
            #{parentBill.id}
          </h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 sm:text-sm">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="sm:hidden">
                {formatDateShort(parentBill.date)}
              </span>
              <span className="hidden sm:inline">
                {formatDate(parentBill.date)}
              </span>
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
  );

  const splitSwitch = (
    <SplitModeSwitch value={splitMode} onChange={setSplitMode} />
  );

  if (splitMode === SPLIT_MATCH) {
    return (
      <div className="px-4 sm:px-0">
        <MatchBillForm
          // Bill con: dựng lại khi tải xong bill chính để form nhận ngày của bill chính
          key={
            !isChildBill
              ? "main"
              : parentBill
                ? `parent-${parentBill.id}`
                : "loading"
          }
          header={renderHeader}
          intro={
            <>
              {parentCard}
              {splitSwitch}
            </>
          }
          initialForm={{
            date: formData.date,
            note: formData.note,
            court_total: formData.court_total,
            matches: [],
          }}
          candidates={matchPlayerCandidates}
          scopeToCandidates={isChildBill}
          backTo={backTo}
          onSave={async (payload) => {
            const response = await billsApi.create({
              ...payload,
              parent_bill_id: parentBillId || null,
            });
            navigate(`/bills/${response.data.id}`);
          }}
          submitLabel="Tạo Bill"
          busyLabel="Đang tạo…"
          errorPrefix="Có lỗi xảy ra khi tạo bill"
          leave={{
            title: "Bỏ bill đang tạo?",
            message: "Các trận đã nhập sẽ mất.",
            confirmLabel: "Bỏ bill",
          }}
          noteHint={isChildBill ? CHILD_NOTE_HINT : undefined}
        />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      {renderHeader(leave.onBackClick)}
      {parentCard}
      {splitSwitch}

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
                noteHint={isChildBill ? CHILD_NOTE_HINT : undefined}
              />
              <BillShuttlesCard
                shuttles={formData.shuttles}
                shuttleTypes={shuttleTypes}
                typesLoading={shuttleTypesLoading}
                quantityErrors={errors?.shuttleQuantity}
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
              parentPlayerIds={
                parentBillId
                  ? (parentBill?.bill_players?.map((bp) => bp.user_id) ?? [])
                  : undefined
              }
              showDefault
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
                    Đang tạo…
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" strokeWidth={2.5} />
                    Tạo Bill
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
        playerCount={playerCount}
        loading={loading}
        label="Tạo Bill"
        busyLabel="Đang tạo…"
      />

      <ConfirmDialog
        isOpen={leave.isOpen}
        onClose={leave.cancel}
        onConfirm={leave.confirm}
        title="Bỏ bill đang tạo?"
        message={
          playerCount > 0
            ? `${playerCount} người chơi và số cầu đã nhập sẽ mất.`
            : "Các thay đổi chưa lưu sẽ mất."
        }
        confirmLabel="Bỏ bill"
      />
    </div>
  );
}
