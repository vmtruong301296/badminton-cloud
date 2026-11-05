import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { partyBillsApi, playersApi } from "../../services/api";
import {
  buildPartyBillPayload,
  partyBillFormErrors,
  partyBillPreview,
} from "../../utils/partyBillTotals";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import useToast from "../../components/ui/useToast";
import usePartyBillForm from "../../components/party/usePartyBillForm";
import {
  PartyBasicInfoCard,
  PartyExtrasCard,
  PartyFormActionBar,
  PartyFormDesktopActions,
  PartySummaryCard,
} from "../../components/party/PartyBillFormSections";
import PartyParticipantsSection from "../../components/party/PartyParticipantsSection";
import {
  focusField,
  focusNextOnEnter,
} from "../../components/bill/billFormFocus";
import { ChevronLeft } from "../../components/ui/icons";

const todayStr = () => new Date().toISOString().split("T")[0];
const FORM_ID = "party-bill-form";

export default function EditPartyBill() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playersError, setPlayersError] = useState(false);
  const [lockedExtras, setLockedExtras] = useState([]);
  const [errors, setErrors] = useState({});
  const {
    form,
    setForm,
    updateField,
    updateExtra,
    addExtra,
    removeExtra,
    updateParticipant,
    removeParticipant,
    selectPlayer,
    unselectPlayer,
  } = usePartyBillForm({
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
      setLoadError(false);
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
        toast.error("Không thể sửa bill tiệc đã thanh toán");
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
      setLoadError(true);
    } finally {
      setInitialLoading(false);
    }
  };

  const loadPlayers = async () => {
    try {
      setLoadingPlayers(true);
      setPlayersError(false);
      const res = await playersApi.getAll();
      setPlayers(res.data || []);
    } catch (error) {
      console.error("Error loading players", error);
      setPlayersError(true);
    } finally {
      setLoadingPlayers(false);
    }
  };

  // Dòng do thuê xe sở hữu không nằm trong form nhưng vẫn là tiền thật của
  // bill: phải cộng vào đây, không thì đơn giá và phần chia của từng người
  // hiện ra thấp hơn con số backend tính khi lưu.
  const preview = partyBillPreview({
    baseAmount: form.base_amount,
    extras: form.extras,
    participants: form.participants,
    lockedExtraTotal: lockedExtras.reduce(
      (sum, item) => sum + (Number(item.amount) || 0),
      0,
    ),
  });

  const handleField = (field, value) => {
    updateField(field, value);
    if (field === "name") setErrors((prev) => ({ ...prev, name: null }));
  };

  const handleSelectPlayer = (player) => {
    selectPlayer(player);
    setErrors((prev) => ({ ...prev, participants: null }));
  };

  const submit = async () => {
    if (saving) return;
    const nextErrors = partyBillFormErrors(form);
    setErrors(nextErrors);
    if (nextErrors.name || nextErrors.participants) {
      focusField(nextErrors.name ? "name" : "participants");
      return;
    }

    try {
      setSaving(true);
      await partyBillsApi.update(
        id,
        buildPartyBillPayload(form, { keepPaid: true }),
      );
      navigate(`/party-bills/${id}`);
    } catch (error) {
      console.error("Error updating party bill", error);
      toast.error(
        "Lỗi: " +
          (error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Cập nhật chia tiệc thất bại"),
        { onRetry: () => formRef.current?.requestSubmit() },
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    submit();
  };

  if (initialLoading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-card">
          Đang tải dữ liệu bill…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="px-4 sm:px-0">
        <EmptyState
          tone="error"
          title="Không thể tải dữ liệu để sửa"
          onRetry={loadInitial}
          action={
            <button
              type="button"
              onClick={() => navigate("/party-bills")}
              className="btn btn-secondary"
            >
              <ChevronLeft className="h-4 w-4" />
              Quay lại danh sách
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      <PageHeader
        back={{ to: `/party-bills/${id}`, label: "Về chi tiết" }}
        title={`Sửa Bill tiệc #${id}`}
      />

      <form
        ref={formRef}
        id={FORM_ID}
        onSubmit={handleSubmit}
        onKeyDown={focusNextOnEnter}
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            <PartyBasicInfoCard
              form={form}
              onField={handleField}
              nameError={errors.name}
            />
            <PartyExtrasCard
              extras={form.extras}
              lockedExtras={lockedExtras}
              totalExtra={preview.totalExtra}
              namePlaceholder="Tên chi phí"
              onUpdate={updateExtra}
              onAdd={addExtra}
              onRemove={removeExtra}
            />
            <PartyParticipantsSection
              participants={preview.participants}
              players={players}
              loadingPlayers={loadingPlayers}
              playersError={playersError}
              onRetryPlayers={loadPlayers}
              onSelectPlayer={handleSelectPlayer}
              onUnselectPlayer={unselectPlayer}
              onUpdate={updateParticipant}
              onRemove={removeParticipant}
              onPlayerCreated={async (player) => {
                await loadPlayers();
                handleSelectPlayer(player);
              }}
              desktopEmptyText="Chưa có người tham gia."
              error={errors.participants}
            />
            <PartyFormDesktopActions
              saving={saving}
              submitLabel="Cập nhật"
              onCancel={() => navigate(`/party-bills/${id}`)}
            />
          </div>

          {/* Summary sidebar */}
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-20 space-y-4">
              <PartySummaryCard
                baseAmount={form.base_amount}
                totalExtra={preview.totalExtra}
                sumRatios={preview.sumRatios}
                unitPrice={preview.unitPrice}
                totalAll={preview.totalAll}
              />
            </div>
          </div>
        </div>
      </form>

      <PartyFormActionBar
        formId={FORM_ID}
        saving={saving}
        submitLabel="Cập nhật"
        totalAll={preview.totalAll}
        peopleCount={form.participants.length}
      />
    </div>
  );
}
