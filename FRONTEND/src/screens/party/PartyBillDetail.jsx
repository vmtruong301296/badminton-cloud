import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { partyBillsApi, paymentAccountsApi } from "../../services/api";
import {
  formatCurrencyRounded,
  formatDate,
  formatRatio,
} from "../../utils/formatters";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PayOldBillsDialog from "../../components/common/PayOldBillsDialog";
import SelectPaymentAccountDialog from "../../components/common/SelectPaymentAccountDialog";
import PartyBillExport from "../../components/party/PartyBillExport";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import {
  Car,
  Loader,
  Pencil,
  Trash2,
  UtensilsCrossed,
  CalendarDays,
  Check,
  Circle,
  Clock,
  Download,
  Send,
} from "../../components/ui/icons";
import {
  nodeToBlob,
  nodeToPng,
  waitForImagesReady,
} from "../../utils/exportImage";

const loadImageAsBase64 = async (url) => {
  try {
    let apiUrl = url;
    if (url.includes("/storage/")) {
      const pathMatch = url.match(/\/storage\/(.+?)(?:\?|$)/);
      if (pathMatch && pathMatch[1]) {
        apiUrl = `/api/images/${pathMatch[1]}`;
      }
    }
    const response = await fetch(apiUrl, {
      mode: "cors",
      credentials: "omit",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("loadImageAsBase64 error:", error);
    throw error;
  }
};

export default function PartyBillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [payingIds, setPayingIds] = useState(new Set());
  const [uncheckPaymentConfirm, setUncheckPaymentConfirm] = useState({
    isOpen: false,
    participantId: null,
    participantName: "",
  });
  const [payOldBillsConfirm, setPayOldBillsConfirm] = useState({
    isOpen: false,
    participantId: null,
    participantName: "",
    debtAmount: 0,
    oldBillIds: [],
  });
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountImages, setPaymentAccountImages] = useState({});
  const [exporting, setExporting] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [pendingExportAction, setPendingExportAction] = useState("download");
  const [selectAccountDialog, setSelectAccountDialog] = useState({
    isOpen: false,
  });
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const exportRef = useRef(null);

  useEffect(() => {
    loadBill();
    loadPaymentAccounts();
  }, [id]);

  const loadBill = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const res = await partyBillsApi.getById(id);
      setBill(res.data);
    } catch (error) {
      console.error("Error loading party bill", error);
      if (!silent) {
        alert("Không tìm thấy bill tiệc");
        navigate("/party-bills");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadPaymentAccounts = async () => {
    try {
      const response = await paymentAccountsApi.getAll({ is_active: true });
      setPaymentAccounts(response.data);

      const imageMap = {};
      const imagePromises = response.data
        .filter((acc) => acc.is_active && acc.qr_code_image)
        .map(async (acc) => {
          try {
            if (acc.qr_code_image.startsWith("data:image/")) {
              imageMap[acc.id] = acc.qr_code_image;
              return;
            }
            const imageUrl =
              acc.qr_code_image_url ||
              (acc.qr_code_image
                ? `${window.location.origin}/storage/${acc.qr_code_image}`
                : null);
            if (imageUrl) {
              const base64 = await loadImageAsBase64(imageUrl);
              imageMap[acc.id] = base64;
            }
          } catch (error) {
            console.error(
              `Failed to preload image for account ${acc.id}:`,
              error,
            );
          }
        });
      await Promise.all(imagePromises);
      setPaymentAccountImages(imageMap);
    } catch (error) {
      console.error("Error loading payment accounts", error);
    }
  };

  const handleMarkPayment = async (participant) => {
    if (!bill) return;
    const isPaid = !participant.is_paid;

    if (!isPaid) {
      setUncheckPaymentConfirm({
        isOpen: true,
        participantId: participant.id,
        participantName: participant.name || "",
      });
      return;
    }

    if (
      isPaid &&
      participant.debt_amount > 0 &&
      participant.debt_details &&
      participant.debt_details.length > 0
    ) {
      const currentBillDate = bill.date
        ? typeof bill.date === "string"
          ? bill.date.slice(0, 10)
          : bill.date
        : null;
      const oldBillIds = participant.debt_details
        .filter((debt) => {
          if (!debt.date || !currentBillDate) return false;
          const debtDate =
            typeof debt.date === "string" ? debt.date.slice(0, 10) : debt.date;
          return debtDate < currentBillDate;
        })
        .map((debt) => debt.bill_id)
        .filter((x) => x);
      if (oldBillIds.length > 0) {
        setPayOldBillsConfirm({
          isOpen: true,
          participantId: participant.id,
          participantName: participant.name || "",
          debtAmount: participant.debt_amount,
          oldBillIds,
        });
        return;
      }
    }

    await executeMarkPayment(participant.id, isPaid, []);
  };

  const executeMarkPayment = async (participantId, isPaid, oldBillIds = []) => {
    if (!bill) return;
    try {
      setPayingIds((prev) => {
        const next = new Set(prev);
        next.add(participantId);
        return next;
      });
      const res = await partyBillsApi.markPayment(bill.id, participantId, {
        is_paid: isPaid,
      });

      if (oldBillIds.length > 0 && isPaid) {
        const participant = bill.participants?.find(
          (p) => p.id === participantId,
        );
        if (participant && participant.user_id) {
          await Promise.all(
            oldBillIds.map(async (oldBillId) => {
              try {
                const oldBillResponse = await partyBillsApi.getById(oldBillId);
                const oldBill = oldBillResponse.data;
                const oldParticipant = oldBill.participants?.find(
                  (p) => p.user_id === participant.user_id,
                );
                if (oldParticipant && !oldParticipant.is_paid) {
                  await partyBillsApi.markPayment(
                    oldBillId,
                    oldParticipant.id,
                    { is_paid: true },
                  );
                }
              } catch (error) {
                console.error(
                  `Error marking payment for old bill ${oldBillId}:`,
                  error,
                );
              }
            }),
          );
        }
      }

      const updated = bill.participants.map((p) =>
        p.id === participantId ? res.data.participant : p,
      );
      setBill({ ...bill, participants: updated });
    } catch (error) {
      console.error("Mark payment error", error);
      alert("Không thể cập nhật thanh toán");
    } finally {
      setPayingIds((prev) => {
        const next = new Set(prev);
        next.delete(participantId);
        return next;
      });
    }
  };

  const handleUncheckPaymentConfirm = async () => {
    await executeMarkPayment(uncheckPaymentConfirm.participantId, false);
    setUncheckPaymentConfirm({
      isOpen: false,
      participantId: null,
      participantName: "",
    });
  };
  const handleUncheckPaymentCancel = () => {
    setUncheckPaymentConfirm({
      isOpen: false,
      participantId: null,
      participantName: "",
    });
  };
  const handlePayOldBillsConfirm = async () => {
    await executeMarkPayment(
      payOldBillsConfirm.participantId,
      true,
      payOldBillsConfirm.oldBillIds,
    );
    setPayOldBillsConfirm({
      isOpen: false,
      participantId: null,
      participantName: "",
      debtAmount: 0,
      oldBillIds: [],
    });
  };
  const handlePayCurrentOnly = async () => {
    await executeMarkPayment(payOldBillsConfirm.participantId, true, []);
    setPayOldBillsConfirm({
      isOpen: false,
      participantId: null,
      participantName: "",
      debtAmount: 0,
      oldBillIds: [],
    });
  };
  const handlePayOldBillsCancel = () => {
    setPayOldBillsConfirm({
      isOpen: false,
      participantId: null,
      participantName: "",
      debtAmount: 0,
      oldBillIds: [],
    });
  };

  const handleDelete = async () => {
    try {
      await partyBillsApi.delete(id);
      navigate("/party-bills");
    } catch (error) {
      console.error("Delete party bill error", error);
      alert("Không thể xóa tiệc");
      setDeleteConfirm(false);
    }
  };

  const handleExportBill = () => {
    if (!bill) return;
    setPendingExportAction("download");
    setSelectAccountDialog({ isOpen: true });
  };
  const handleSendTelegramClick = () => {
    if (!bill) return;
    setPendingExportAction("telegram");
    setSelectAccountDialog({ isOpen: true });
  };
  const handleSelectAccountConfirm = async (accountId) => {
    setSelectAccountDialog({ isOpen: false });
    if (pendingExportAction === "telegram") {
      await executeSendTelegram(accountId);
    } else {
      await executeExportBill(accountId);
    }
  };
  const handleSelectAccountCancel = () => {
    setSelectAccountDialog({ isOpen: false });
    setSelectedAccountId(null);
  };

  const executeExportBill = async (accountId) => {
    if (!bill) return;
    setSelectedAccountId(accountId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!exportRef.current) {
      setExporting(false);
      return;
    }

    try {
      setExporting(true);
      const accountsNeedingPreload = paymentAccounts.filter(
        (acc) =>
          acc.is_active && acc.qr_code_image && !paymentAccountImages[acc.id],
      );
      if (accountsNeedingPreload.length > 0) {
        const imageMap = { ...paymentAccountImages };
        await Promise.all(
          accountsNeedingPreload.map(async (acc) => {
            try {
              if (acc.qr_code_image.startsWith("data:image/")) {
                imageMap[acc.id] = acc.qr_code_image;
                return;
              }
              const imageUrl =
                acc.qr_code_image_url ||
                (acc.qr_code_image
                  ? `${window.location.origin}/storage/${acc.qr_code_image}`
                  : null);
              if (imageUrl) {
                const base64 = await loadImageAsBase64(imageUrl);
                imageMap[acc.id] = base64;
              }
            } catch (error) {
              console.error("Preload image error", error);
            }
          }),
        );
        setPaymentAccountImages(imageMap);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const images = exportRef.current.querySelectorAll(
        "img.bill-export-image",
      );
      await waitForImagesReady(images);

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      await new Promise((resolve) => setTimeout(resolve, 200));

      const dataUrl = await nodeToPng(exportRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `Bill_Tiec_${bill.id}_${formatDate(bill.date).replace(/\//g, "-")}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error exporting bill", error);
      alert("Có lỗi xảy ra khi xuất bill");
    } finally {
      setExporting(false);
    }
  };

  /**
   * Render party bill via the same canvas pipeline as executeExportBill,
   * then upload the PNG to backend which forwards it to Telegram.
   */
  const executeSendTelegram = async (accountId) => {
    if (!bill) return;
    setSelectedAccountId(accountId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!exportRef.current) {
      setSendingTelegram(false);
      return;
    }

    try {
      setSendingTelegram(true);
      const accountsNeedingPreload = paymentAccounts.filter(
        (acc) =>
          acc.is_active && acc.qr_code_image && !paymentAccountImages[acc.id],
      );
      if (accountsNeedingPreload.length > 0) {
        const imageMap = { ...paymentAccountImages };
        await Promise.all(
          accountsNeedingPreload.map(async (acc) => {
            try {
              if (acc.qr_code_image.startsWith("data:image/")) {
                imageMap[acc.id] = acc.qr_code_image;
                return;
              }
              const imageUrl =
                acc.qr_code_image_url ||
                (acc.qr_code_image
                  ? `${window.location.origin}/storage/${acc.qr_code_image}`
                  : null);
              if (imageUrl) {
                const base64 = await loadImageAsBase64(imageUrl);
                imageMap[acc.id] = base64;
              }
            } catch (error) {
              console.error("Preload image error", error);
            }
          }),
        );
        setPaymentAccountImages(imageMap);
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const images = exportRef.current.querySelectorAll(
        "img.bill-export-image",
      );
      await waitForImagesReady(images);

      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      );
      await new Promise((resolve) => setTimeout(resolve, 200));

      const blob = await nodeToBlob(exportRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      if (!blob) throw new Error("Không tạo được file PNG");

      await partyBillsApi.sendTelegram(bill.id, blob);
      alert("Đã gửi bill tiệc qua Telegram thành công!");
    } catch (error) {
      console.error("Error sending party bill to Telegram:", error);
      const detail =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        error?.message ||
        "Lỗi không xác định";
      alert("Gửi Telegram thất bại: " + detail);
    } finally {
      setSendingTelegram(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-0">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-card">
          Đang tải bill tiệc…
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="px-4 sm:px-0">
        <EmptyState
          icon={UtensilsCrossed}
          title="Không tìm thấy bill tiệc"
          description="Bill này có thể đã bị xóa hoặc không tồn tại."
          action={
            <button
              type="button"
              onClick={() => navigate("/party-bills")}
              className="btn btn-secondary"
            >
              Quay lại danh sách
            </button>
          }
        />
      </div>
    );
  }

  const participants = bill.participants || [];
  const hasPaidParticipants = participants.some((p) => p.is_paid);
  const allPaid =
    participants.length > 0 && participants.every((p) => p.is_paid);

  const totalFoodAmount = participants.reduce(
    (sum, p) => sum + (Number(p.food_amount) || 0),
    0,
  );
  const totalPaidAmount = participants.reduce(
    (sum, p) => sum + (Number(p.paid_amount) || 0),
    0,
  );
  const grandTotal =
    (Number(bill.base_amount) || 0) +
    (Number(bill.total_extra) || 0) +
    totalFoodAmount;

  // Sort: unpaid males, unpaid females, paid males, paid females
  const sortedParticipants = [...participants].sort((a, b) => {
    const aIsPaid = a.is_paid || false;
    const bIsPaid = b.is_paid || false;
    const aGender = a.user?.gender || a.gender || "";
    const bGender = b.user?.gender || b.gender || "";
    if (aIsPaid !== bIsPaid) return aIsPaid ? 1 : -1;
    if (aGender !== bGender) {
      if (aGender === "male") return -1;
      if (bGender === "male") return 1;
    }
    return 0;
  });

  return (
    <div className="px-4 pb-6 sm:px-0 md:pb-0">
      <PageHeader
        back={{ to: "/party-bills", label: "Danh sách" }}
        title={bill.name || "Bill tiệc"}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span
              className={`badge gap-1.5 ${
                allPaid
                  ? "badge-emerald"
                  : hasPaidParticipants
                    ? "badge-amber"
                    : "badge-slate"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  allPaid
                    ? "bg-emerald-500"
                    : hasPaidParticipants
                      ? "bg-amber-500"
                      : "bg-slate-400"
                }`}
                aria-hidden
              />
              {allPaid
                ? "Đã thanh toán"
                : hasPaidParticipants
                  ? "Thanh toán 1 phần"
                  : "Chưa thanh toán"}
            </span>
            <span>Bill tiệc #{bill.id}</span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {formatDate(bill.date)}
            </span>
          </span>
        }
        actions={
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center">
            <button
              type="button"
              onClick={handleExportBill}
              disabled={exporting}
              className="btn btn-primary flex-1 sm:flex-none"
            >
              {exporting ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Đang xuất…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Xuất Bill
                </>
              )}
            </button>
            <button
              type="button"
              onClick={handleSendTelegramClick}
              disabled={sendingTelegram || exporting}
              className="btn btn-secondary flex-1 sm:flex-none"
            >
              {sendingTelegram ? (
                <>
                  <Loader className="h-4 w-4 animate-spin" />
                  Đang gửi…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Gửi Telegram
                </>
              )}
            </button>
            {!allPaid && (
              <button
                type="button"
                onClick={() => navigate(`/party-bills/${id}/edit`)}
                className="btn btn-secondary flex-1 sm:flex-none"
              >
                <Pencil className="h-4 w-4" />
                Sửa bill
              </button>
            )}
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              aria-label="Xóa bill"
              className="btn btn-secondary w-full shrink-0 !px-0 hover:!border-rose-200 hover:!bg-rose-50 hover:!text-rose-700 sm:w-10"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          </div>
        }
      />

      {/* Info & Extras */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 lg:grid-cols-10">
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:col-span-6">
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
            <p className="text-sm font-semibold text-slate-900">
              Thông tin Bill
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4">
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Tiền tiệc
                </div>
                <div className="font-tabular mt-1 text-sm font-semibold text-slate-900 sm:text-lg">
                  {formatCurrencyRounded(bill.base_amount || 0)}
                </div>
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500">
                  Chi phí thêm
                </div>
                <div className="font-tabular mt-1 text-sm font-semibold text-slate-900 sm:text-lg">
                  {formatCurrencyRounded(bill.total_extra || 0)}
                </div>
              </div>
              <div className="sm:order-last">
                <div className="text-xs font-medium text-slate-500">
                  Đơn giá / mức
                </div>
                <div className="font-tabular mt-1 text-sm font-semibold text-slate-900 sm:text-lg">
                  {formatCurrencyRounded(bill.unit_price || 0)}
                </div>
              </div>
              <div className="col-span-3 rounded-xl bg-emerald-50/70 p-3 sm:col-span-1 sm:order-3">
                <div className="text-xs font-medium text-emerald-700">
                  Tổng tiệc
                </div>
                <div className="font-display font-tabular mt-1 text-2xl font-semibold text-emerald-700">
                  {formatCurrencyRounded(grandTotal)}
                </div>
              </div>
            </div>
            {bill.note && (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
                <div className="mb-0.5 text-xs font-medium text-amber-700">
                  Ghi chú
                </div>
                <div className="text-slate-700">{bill.note}</div>
              </div>
            )}
          </div>
        </section>

        {bill.extras && bill.extras.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:col-span-4">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
              <p className="text-sm font-semibold text-slate-900">
                Chi phí thêm
              </p>
              <span className="font-tabular text-xs font-semibold text-slate-600">
                {formatCurrencyRounded(bill.total_extra || 0)}
              </span>
            </div>
            <div className="divide-y divide-slate-100 px-4 sm:px-5">
              {bill.extras.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between py-2.5 text-sm"
                >
                  <span className="text-slate-700">
                    {ex.car_rental_comparison_id && (
                      <Car className="mr-1.5 inline-block h-4 w-4 align-[-3px] text-slate-500" />
                    )}
                    {ex.name}
                    {ex.car_rental_comparison_id && (
                      <Link
                        to="/car-rental"
                        className="mt-0.5 block pl-[22px] text-xs text-blue-600 underline"
                      >
                        xem chuyến xe
                      </Link>
                    )}
                  </span>
                  <span className="font-tabular shrink-0 pl-3 font-semibold text-slate-900">
                    {formatCurrencyRounded(ex.amount)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Participants */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
          <p className="text-sm font-semibold text-slate-900">
            Người tham gia
          </p>
          <span className="font-tabular text-xs text-slate-500">
            {participants.length} người
          </span>
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto p-2 sm:p-3">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b text-xs font-medium text-slate-500">
                <th className="px-2 py-2 text-left">STT</th>
                <th className="px-2 py-2 text-left">Tên</th>
                <th className="px-2 py-2 text-right">Mức tính</th>
                <th className="px-2 py-2 text-right">Đã chi</th>
                <th className="px-2 py-2 text-right">Tiền thêm</th>
                <th className="px-2 py-2 text-left">Ghi chú</th>
                <th className="px-2 py-2 text-right">Thành tiền</th>
                <th className="px-2 py-2 text-center">Đã TT</th>
              </tr>
            </thead>
            <tbody>
              {sortedParticipants.map((p, index) => {
                const shareAmount = p.share_amount || 0;
                const foodAmount = p.food_amount || 0;
                const paidAmount = p.paid_amount || 0;
                const totalAmount = shareAmount + foodAmount - paidAmount;
                return (
                  <tr
                    key={p.id}
                    className={`border-b transition ${
                      p.is_paid
                        ? "bg-emerald-50/30 hover:bg-emerald-50/60"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td className="px-2 py-3 text-slate-500">{index + 1}</td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {p.name}
                        </span>
                        {p.user?.gender === "female" && (
                          <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
                            Nữ
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="font-tabular px-2 py-3 text-right text-slate-700">
                      {formatRatio(p.ratio_value)}
                    </td>
                    <td className="font-tabular px-2 py-3 text-right text-slate-700">
                      {formatCurrencyRounded(paidAmount)}
                    </td>
                    <td className="font-tabular px-2 py-3 text-right text-slate-700">
                      {formatCurrencyRounded(foodAmount)}
                    </td>
                    <td className="px-2 py-3 text-xs text-slate-500">
                      {p.note || "—"}
                    </td>
                    <td className="font-tabular px-2 py-3 text-right font-semibold text-emerald-700">
                      {formatCurrencyRounded(totalAmount)}
                    </td>
                    <td className="px-2 py-3 text-center">
                      <label className="inline-flex h-10 w-10 cursor-pointer items-center justify-center">
                        <input
                          type="checkbox"
                          checked={p.is_paid || false}
                          disabled={payingIds.has(p.id)}
                          onChange={() => handleMarkPayment(p)}
                          aria-label={`Đánh dấu ${p.name} đã thanh toán`}
                          className="h-5 w-5 cursor-pointer accent-emerald-700"
                        />
                      </label>
                      {p.paid_at && (
                        <div className="mt-1 text-xs text-slate-500">
                          {new Date(p.paid_at).toLocaleString("vi-VN")}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-emerald-200 bg-emerald-50/40 font-semibold">
                <td colSpan="3" className="px-2 py-3 text-right text-slate-700">
                  Tổng cộng:
                </td>
                <td className="font-tabular px-2 py-3 text-right text-slate-700">
                  {formatCurrencyRounded(totalPaidAmount)}
                </td>
                <td className="font-tabular px-2 py-3 text-right text-slate-700">
                  {formatCurrencyRounded(totalFoodAmount)}
                </td>
                <td></td>
                <td className="font-tabular px-2 py-3 text-right text-emerald-700">
                  {formatCurrencyRounded(
                    participants.reduce(
                      (sum, p) =>
                        sum +
                        ((p.share_amount || 0) +
                          (p.food_amount || 0) -
                          (p.paid_amount || 0)),
                      0,
                    ),
                  )}
                </td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden space-y-2.5 p-3">
          {sortedParticipants.map((p, index) => {
            const shareAmount = p.share_amount || 0;
            const foodAmount = p.food_amount || 0;
            const paidAmount = p.paid_amount || 0;
            const totalAmount = shareAmount + foodAmount - paidAmount;
            return (
              <article
                key={p.id}
                className={`overflow-hidden rounded-xl border transition ${
                  p.is_paid
                    ? "border-emerald-200 bg-emerald-50/40"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-tabular inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">
                          {index + 1}
                        </span>
                        <h4 className="truncate font-semibold text-slate-900">
                          {p.name}
                        </h4>
                        {p.user?.gender === "female" && (
                          <span className="rounded-full bg-pink-100 px-2 py-0.5 text-xs font-medium text-pink-700">
                            Nữ
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                        <span>Mức tính</span>
                        <span className="font-tabular font-medium text-slate-700">
                          {formatRatio(p.ratio_value)}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display font-tabular text-xl font-semibold text-slate-900">
                        {formatCurrencyRounded(totalAmount)}
                      </div>
                      <label
                        className={`mt-1.5 inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition cursor-pointer select-none active:scale-95 ${
                          payingIds.has(p.id)
                            ? "opacity-50 pointer-events-none"
                            : ""
                        } has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-100 has-[:checked]:text-emerald-800 border-slate-200 bg-white text-slate-600`}
                      >
                        <input
                          type="checkbox"
                          checked={p.is_paid || false}
                          disabled={payingIds.has(p.id)}
                          onChange={() => handleMarkPayment(p)}
                          className="sr-only"
                        />
                        {p.is_paid ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                        {p.is_paid ? "Đã thanh toán" : "Đánh dấu TT"}
                      </label>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 text-xs">
                    <div>
                      <div className="text-xs text-slate-500">
                        Chia bill
                      </div>
                      <div className="font-tabular mt-0.5 font-semibold text-slate-900">
                        {formatCurrencyRounded(shareAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">
                        Đã chi
                      </div>
                      <div className="font-tabular mt-0.5 font-semibold text-slate-900">
                        {formatCurrencyRounded(paidAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500">
                        Tiền thêm
                      </div>
                      <div className="font-tabular mt-0.5 font-semibold text-slate-900">
                        {formatCurrencyRounded(foodAmount)}
                      </div>
                    </div>
                  </div>

                  {p.note && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-600">
                      <div className="text-xs font-medium text-slate-500">
                        Ghi chú
                      </div>
                      <div className="mt-0.5">{p.note}</div>
                    </div>
                  )}

                  {p.paid_at && (
                    <div className="mt-2 flex items-center gap-1 text-xs text-emerald-700">
                      <Clock className="h-3.5 w-3.5" />
                      {new Date(p.paid_at).toLocaleString("vi-VN")}
                    </div>
                  )}
                </div>
              </article>
            );
          })}

          {participants.length === 0 && (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
              Chưa có người tham gia
            </div>
          )}

          {participants.length > 0 && (
            <div className="mt-2 rounded-xl bg-emerald-50/70 px-3 py-2.5">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-medium text-emerald-700">
                  Tổng người tham gia
                </span>
                <span className="font-display font-tabular text-xl font-semibold text-emerald-700">
                  {formatCurrencyRounded(
                    participants.reduce(
                      (sum, p) =>
                        sum +
                        ((p.share_amount || 0) +
                          (p.food_amount || 0) -
                          (p.paid_amount || 0)),
                      0,
                    ),
                  )}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={() => setDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Xác nhận xóa bill tiệc"
        message="Bạn có chắc chắn muốn xóa bill tiệc này? Hành động không thể hoàn tác."
      />

      <ConfirmDialog
        isOpen={uncheckPaymentConfirm.isOpen}
        onClose={handleUncheckPaymentCancel}
        onConfirm={handleUncheckPaymentConfirm}
        title="Xác nhận hủy thanh toán"
        message={`Bạn có chắc chắn muốn hủy trạng thái "Đã thanh toán" cho ${uncheckPaymentConfirm.participantName}?`}
      />

      <PayOldBillsDialog
        isOpen={payOldBillsConfirm.isOpen}
        onClose={handlePayOldBillsCancel}
        onPayCurrentOnly={handlePayCurrentOnly}
        onPayAll={handlePayOldBillsConfirm}
        playerName={payOldBillsConfirm.participantName}
        debtAmount={payOldBillsConfirm.debtAmount}
      />

      <SelectPaymentAccountDialog
        isOpen={selectAccountDialog.isOpen}
        onClose={handleSelectAccountCancel}
        onConfirm={handleSelectAccountConfirm}
        paymentAccounts={paymentAccounts}
      />

      {/* Always rendered when bill is loaded, positioned off-screen.
          html-to-image snapshots the target node directly via SVG
          foreignObject, so wrapper position does not affect capture. */}
      {bill && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            top: 0,
            left: "-9999px",
            pointerEvents: "none",
          }}
        >
          <div ref={exportRef}>
            <PartyBillExport
              bill={bill}
              paymentAccounts={
                selectedAccountId
                  ? paymentAccounts.filter(
                      (acc) => acc.id === selectedAccountId,
                    )
                  : []
              }
              paymentAccountImages={paymentAccountImages}
            />
          </div>
        </div>
      )}
    </div>
  );
}
