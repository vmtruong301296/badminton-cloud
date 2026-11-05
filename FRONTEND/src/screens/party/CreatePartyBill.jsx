import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { partyBillsApi, playersApi } from "../../services/api";
import {
  buildPartyBillPayload,
  partyBillFormErrors,
  partyBillPreview,
} from "../../utils/partyBillTotals";
import PageHeader from "../../components/ui/PageHeader";
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

const todayStr = () => new Date().toISOString().split("T")[0];
const FORM_ID = "party-bill-form";

export default function CreatePartyBill() {
  const navigate = useNavigate();
  const toast = useToast();
  const formRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);
  const [playersError, setPlayersError] = useState(false);
  const [errors, setErrors] = useState({});
  const {
    form,
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
    extras: [{ name: "Bánh + Tôm", amount: 0 }],
    participants: [],
  });

  useEffect(() => {
    loadPlayers();
  }, []);

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

  const preview = partyBillPreview({
    baseAmount: form.base_amount,
    extras: form.extras,
    participants: form.participants,
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
      const res = await partyBillsApi.create(buildPartyBillPayload(form));
      navigate(`/party-bills/${res.data.id}`);
    } catch (error) {
      console.error("Error creating party bill", error);
      toast.error(
        "Lỗi: " +
          (error.response?.data?.error ||
            error.response?.data?.message ||
            error.message ||
            "Tạo chia tiệc thất bại"),
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

  return (
    <div className="px-4 sm:px-0">
      <PageHeader
        back={{ to: "/party-bills", label: "Danh sách" }}
        title="Tạo Bill tiệc mới"
      />

      <form
        ref={formRef}
        id={FORM_ID}
        onSubmit={handleSubmit}
        onKeyDown={focusNextOnEnter}
        noValidate
      >
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Main form */}
          <div className="space-y-4 sm:space-y-6 lg:col-span-2">
            <PartyBasicInfoCard
              form={form}
              onField={handleField}
              nameError={errors.name}
              namePlaceholder="Tiệc sinh nhật..."
            />
            <PartyExtrasCard
              extras={form.extras}
              totalExtra={preview.totalExtra}
              namePlaceholder="Tên chi phí (ví dụ: Bánh kem)"
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
              desktopEmptyText="Chọn người chơi từ danh sách bên trái để bắt đầu chia tiền."
              error={errors.participants}
            />
            <PartyFormDesktopActions
              saving={saving}
              submitLabel="Tạo Bill tiệc"
              onCancel={() => navigate("/party-bills")}
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
        submitLabel="Tạo"
        totalAll={preview.totalAll}
        peopleCount={form.participants.length}
      />
    </div>
  );
}
