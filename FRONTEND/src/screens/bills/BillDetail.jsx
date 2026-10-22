import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { billsApi, paymentAccountsApi } from "../../services/api";
import {
  formatCurrency,
  formatCurrencyRounded,
  formatDate,
  formatDateDisplay,
  formatRatio,
} from "../../utils/formatters";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PayOldBillsDialog from "../../components/common/PayOldBillsDialog";
import SelectPaymentAccountDialog from "../../components/common/SelectPaymentAccountDialog";
import BillContent from "../../components/bill/BillContent";
import BillExport from "../../components/bill/BillExport";
import {
  waitForImagesReady,
  nodeToPng,
  nodeToBlob,
} from "../../utils/exportImage";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  Circle,
  CircleAlert,
  Clock,
  Download,
  Loader,
  Pencil,
  Plus,
  Send,
  Trash2,
} from "../../components/ui/icons";

export default function BillDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bill, setBill] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [uncheckPaymentConfirm, setUncheckPaymentConfirm] = useState({
    isOpen: false,
    playerId: null,
    playerName: "",
  });
  const [payOldBillsConfirm, setPayOldBillsConfirm] = useState({
    isOpen: false,
    playerId: null,
    playerName: "",
    debtAmount: 0,
    oldBillIds: [],
  });
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [paymentAccountImages, setPaymentAccountImages] = useState({}); // Store base64 images: { accountId: base64 }
  const [exporting, setExporting] = useState(false);
  const [sendingTelegram, setSendingTelegram] = useState(false);
  const [pendingExportAction, setPendingExportAction] = useState("download"); // "download" | "telegram"
  const [selectAccountDialog, setSelectAccountDialog] = useState({
    isOpen: false,
  });
  const [selectedAccountId, setSelectedAccountId] = useState(null);
  const exportRef = useRef(null);

  useEffect(() => {
    loadBill();
    loadPaymentAccounts();
  }, [id]);

  /**
   * Load bill data.
   * @param {object} [opts]
   * @param {boolean} [opts.silent] - When true, don't show skeleton.
   *   Use after mutating actions (mark payment, etc.) to refresh
   *   server-recalculated fields (debt_amount, debt_details) without UI flicker.
   */
  const loadBill = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      const response = await billsApi.getById(id);
      setBill(response.data);
    } catch (error) {
      console.error("Error loading bill:", error);
      if (!silent) {
        alert("Không tìm thấy bill");
        navigate("/");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleMarkPayment = async (playerId, isPaid) => {
    // Nếu đang uncheck (từ checked -> unchecked), hiển thị confirm dialog
    if (!isPaid) {
      const player = bill.bill_players?.find((p) => p.user_id === playerId);
      if (player) {
        setUncheckPaymentConfirm({
          isOpen: true,
          playerId,
          playerName: player.user?.name || "",
        });
        return;
      }
    }

    // Nếu đang check (từ unchecked -> checked)
    const player = bill.bill_players?.find((p) => p.user_id === playerId);
    if (player && player.debt_amount > 0 && isPaid) {
      // Nếu có tiền nợ, hiển thị confirm dialog hỏi có thanh toán bill cũ không
      const oldBillIdsSet = new Set();
      if (player.debt_details && player.debt_details.length > 0) {
        player.debt_details.forEach((debt) => {
          if (debt.parent_bill_id) {
            oldBillIdsSet.add(debt.parent_bill_id);
          }
          if (debt.sub_bills && debt.sub_bills.length > 0) {
            debt.sub_bills.forEach((subBill) => {
              if (subBill.bill_id) {
                oldBillIdsSet.add(subBill.bill_id);
              }
            });
          }
        });
      }

      setPayOldBillsConfirm({
        isOpen: true,
        playerId,
        playerName: player.user?.name || "",
        debtAmount: player.debt_amount,
        oldBillIds: Array.from(oldBillIdsSet),
      });
      return;
    }

    // Nếu không có tiền nợ hoặc đang uncheck, gọi API trực tiếp
    await executeMarkPayment(playerId, isPaid);
  };

  const executeMarkPayment = async (playerId, isPaid, oldBillIds = []) => {
    try {
      // Mark payment cho bill hiện tại
      await billsApi.markPayment(id, playerId, {
        amount: bill.bill_players.find((p) => p.user_id === playerId)
          ?.total_amount,
        is_paid: isPaid,
      });

      // Nếu bill hiện tại là parent bill và đang mark as paid, mark payment cho tất cả sub-bills
      if (
        !bill.parent_bill_id &&
        bill.sub_bills &&
        bill.sub_bills.length > 0 &&
        isPaid
      ) {
        const promises = bill.sub_bills.map(async (subBill) => {
          try {
            // Tìm player trong sub-bill
            const subBillPlayer = subBill.bill_players?.find(
              (p) => p.user_id === playerId,
            );
            if (subBillPlayer) {
              await billsApi.markPayment(subBill.id, playerId, {
                amount: subBillPlayer.total_amount,
                is_paid: true,
              });
            }
          } catch (error) {
            console.error(
              `Error marking payment for sub-bill ${subBill.id}:`,
              error,
            );
          }
        });
        await Promise.all(promises);
      }

      // Nếu có bill cũ cần thanh toán, mark payment cho từng bill
      if (oldBillIds.length > 0 && isPaid) {
        const player = bill.bill_players?.find((p) => p.user_id === playerId);
        if (player) {
          // Lấy thông tin bill cũ từ debt_details để lấy bill_id và user_id
          const promises = oldBillIds.map(async (oldBillId) => {
            try {
              // Lấy bill cũ để lấy user_id của player trong bill đó
              const oldBillResponse = await billsApi.getById(oldBillId);
              const oldBill = oldBillResponse.data;
              const oldBillPlayer = oldBill.bill_players?.find(
                (p) => p.user_id === playerId,
              );
              if (oldBillPlayer) {
                await billsApi.markPayment(oldBillId, playerId, {
                  amount: oldBillPlayer.total_amount,
                  is_paid: true,
                });
              }
            } catch (error) {
              console.error(
                `Error marking payment for old bill ${oldBillId}:`,
                error,
              );
            }
          });
          await Promise.all(promises);
        }
      }

      // Silent reload — refresh server-recalculated debt_amount/debt_details
      // without triggering the loading skeleton.
      await loadBill({ silent: true });
    } catch (error) {
      console.error("Error marking payment:", error);
      alert("Có lỗi xảy ra");
    }
  };

  const handleUncheckPaymentConfirm = async () => {
    await executeMarkPayment(uncheckPaymentConfirm.playerId, false);
    setUncheckPaymentConfirm({ isOpen: false, playerId: null, playerName: "" });
  };

  const handleUncheckPaymentCancel = () => {
    setUncheckPaymentConfirm({ isOpen: false, playerId: null, playerName: "" });
    // Dialog was cancelled — no server state changed, no reload needed.
    // The toggle pill reads from `bill.bill_players[...].is_paid` which is unchanged.
  };

  const handlePayOldBillsConfirm = async () => {
    await executeMarkPayment(
      payOldBillsConfirm.playerId,
      true,
      payOldBillsConfirm.oldBillIds,
    );
    setPayOldBillsConfirm({
      isOpen: false,
      playerId: null,
      playerName: "",
      debtAmount: 0,
      oldBillIds: [],
    });
  };

  const handlePayOldBillsCancel = async () => {
    // Chỉ thanh toán bill hiện tại, không thanh toán bill cũ
    await executeMarkPayment(payOldBillsConfirm.playerId, true, []);
    setPayOldBillsConfirm({
      isOpen: false,
      playerId: null,
      playerName: "",
      debtAmount: 0,
      oldBillIds: [],
    });
  };

  const handleDeleteClick = () => {
    setDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await billsApi.delete(id);
      navigate("/");
    } catch (error) {
      console.error("Error deleting bill:", error);
      alert("Có lỗi xảy ra khi xóa bill");
      setDeleteConfirm(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm(false);
  };

  // Helper to convert image URL to base64 using fetch API (bypasses CORS)
  const loadImageAsBase64 = async (url) => {
    try {
      console.log("loadImageAsBase64 - Starting for URL:", url);

      // Convert storage URL to API route if needed
      let apiUrl = url;
      if (url.includes("/storage/")) {
        // Extract path after /storage/
        const pathMatch = url.match(/\/storage\/(.+?)(?:\?|$)/);
        if (pathMatch && pathMatch[1]) {
          const cleanPath = pathMatch[1];
          // If URL is absolute (starts with http), extract just the path
          if (url.startsWith("http")) {
            apiUrl = `/api/images/${cleanPath}`;
          } else {
            apiUrl = `/api/images/${cleanPath}`;
          }
          console.log("loadImageAsBase64 - Converted to API route:", apiUrl);
        } else {
          console.warn(
            "loadImageAsBase64 - Could not extract path from URL:",
            url,
          );
        }
      }

      // Use fetch to get image as blob
      const response = await fetch(apiUrl, {
        mode: "cors",
        credentials: "omit",
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      console.log(
        "loadImageAsBase64 - Blob received, size:",
        blob.size,
        "type:",
        blob.type,
      );

      // Convert blob to base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64 = reader.result;
          console.log(
            "loadImageAsBase64 - Converted to base64, length:",
            base64.length,
          );
          resolve(base64);
        };
        reader.onerror = (error) => {
          console.error("loadImageAsBase64 - FileReader error:", error);
          reject(error);
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("loadImageAsBase64 - Error:", error, "URL:", url);
      throw error;
    }
  };

  const loadPaymentAccounts = async () => {
    try {
      const response = await paymentAccountsApi.getAll({ is_active: true });
      console.log("BillDetail - Payment accounts loaded:", response.data);

      setPaymentAccounts(response.data);

      // Preload and convert images to base64
      // If qr_code_image is already a base64 string (starts with data:image/), use it directly
      const imageMap = {};
      const imagePromises = response.data
        .filter((acc) => acc.is_active && acc.qr_code_image)
        .map(async (acc) => {
          try {
            // Check if qr_code_image is already a base64 string
            if (acc.qr_code_image.startsWith("data:image/")) {
              // Already base64, use directly
              imageMap[acc.id] = acc.qr_code_image;
              console.log(`Account ${acc.id}: Using direct base64 image`);
              return;
            }

            // Otherwise, it's a file path, need to load and convert
            const imageUrl =
              acc.qr_code_image_url ||
              (acc.qr_code_image
                ? `${window.location.origin}/storage/${acc.qr_code_image}`
                : null);

            if (imageUrl) {
              console.log(`Preloading image for account ${acc.id}:`, imageUrl);
              const base64 = await loadImageAsBase64(imageUrl);
              imageMap[acc.id] = base64;
              console.log(`Account ${acc.id}: Image preloaded successfully`);
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
      console.log(
        "All payment account images preloaded:",
        Object.keys(imageMap),
      );
    } catch (error) {
      console.error("Error loading payment accounts:", error);
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
  };

  const executeExportBill = async (accountId) => {
    if (!bill) return;

    // Đảm bảo selectedAccountId đã được set và component đã render
    setSelectedAccountId(accountId);
    // Đợi component re-render với tài khoản mới
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!exportRef.current) {
      console.error("Export ref not available");
      setExporting(false);
      return;
    }

    try {
      setExporting(true);

      // Ensure all payment account images are preloaded before export
      // If qr_code_image is already base64, use it directly
      const accountsNeedingPreload = paymentAccounts.filter(
        (acc) =>
          acc.is_active && acc.qr_code_image && !paymentAccountImages[acc.id],
      );

      if (accountsNeedingPreload.length > 0) {
        console.log(
          "Preloading missing images before export:",
          accountsNeedingPreload.length,
        );
        const imageMap = { ...paymentAccountImages };

        await Promise.all(
          accountsNeedingPreload.map(async (acc) => {
            try {
              // Check if qr_code_image is already a base64 string
              if (acc.qr_code_image.startsWith("data:image/")) {
                // Already base64, use directly
                imageMap[acc.id] = acc.qr_code_image;
                console.log(
                  `Account ${acc.id}: Using direct base64 image for export`,
                );
                return;
              }

              // Otherwise, it's a file path, need to load and convert
              const imageUrl =
                acc.qr_code_image_url ||
                (acc.qr_code_image
                  ? `${window.location.origin}/storage/${acc.qr_code_image}`
                  : null);

              if (imageUrl) {
                console.log(
                  `Preloading image for account ${acc.id} before export:`,
                  imageUrl,
                );
                const base64 = await loadImageAsBase64(imageUrl);
                imageMap[acc.id] = base64;
                console.log(`Account ${acc.id}: Image preloaded before export`);
              }
            } catch (error) {
              console.error(
                `Failed to preload image for account ${acc.id} before export:`,
                error,
              );
            }
          }),
        );

        setPaymentAccountImages(imageMap);
        // Wait a bit for state to update and component to re-render
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      const images = exportRef.current.querySelectorAll(
        "img.bill-export-image",
      );
      await waitForImagesReady(images);

      // Wait for fonts + paint before capture. html-to-image uses SVG
      // foreignObject so styles/fonts are serialized into the snapshot
      // atomically — no iframe-clone race condition like html2canvas.
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
      link.download = `Bill_${bill.id}_${formatDate(bill.date).replace(/\//g, "-")}.png`;
      link.href = dataUrl;
      link.click();

      setExporting(false);
    } catch (error) {
      console.error("Error exporting bill:", error);
      alert("Có lỗi xảy ra khi xuất bill");
      setExporting(false);
    }
  };

  /**
   * Render the bill the same way as export, but upload the PNG to backend
   * which forwards it to the Telegram chat configured in BACKEND/.env.
   * Reuses the same image-preload + html2canvas pipeline as executeExportBill.
   */
  const executeSendTelegram = async (accountId) => {
    if (!bill) return;
    setSelectedAccountId(accountId);
    await new Promise((resolve) => setTimeout(resolve, 300));

    if (!exportRef.current) {
      console.error("Export ref not available");
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

      await billsApi.sendTelegram(bill.id, blob);
      alert("Đã gửi bill qua Telegram thành công!");
    } catch (error) {
      console.error("Error sending bill to Telegram:", error);
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
        {/* Header skeleton */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex-1">
            <div className="skeleton h-3 w-24 mb-2" />
            <div className="skeleton h-8 w-56 mb-2" />
            <div className="skeleton h-3 w-32" />
          </div>
          <div className="skeleton h-10 w-32" />
        </div>
        {/* Info card skeleton */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i}>
              <div className="skeleton h-3 w-20 mb-2" />
              <div className="skeleton h-6 w-24" />
            </div>
          ))}
        </div>
        {/* Players skeleton */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card space-y-3">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-slate-100 pb-3 last:border-0"
            >
              <div className="flex-1">
                <div className="skeleton h-4 w-32 mb-2" />
                <div className="skeleton h-3 w-20" />
              </div>
              <div className="skeleton h-5 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!bill) {
    return (
      <div className="px-4 sm:px-0">
        <EmptyState
          icon={CircleAlert}
          title="Không tìm thấy bill"
          description="Bill này có thể đã bị xóa hoặc không tồn tại."
          action={
            <button
              type="button"
              onClick={() => navigate("/")}
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

  const hasPaidPlayers = bill.bill_players?.some((p) => p.is_paid) || false;
  const allPaid =
    bill.bill_players?.length > 0 && bill.bill_players?.every((p) => p.is_paid);

  return (
    <div className="px-4 sm:px-0 pb-6 md:pb-0">
      {/* Back link — bill con quay về bill chính của nó */}
      <PageHeader
        back={{
          to: bill.parent_bill_id ? `/bills/${bill.parent_bill_id}` : "/",
          label: bill.parent_bill_id
            ? `Bill chính #${bill.parent_bill_id}`
            : "Danh sách bills",
        }}
        title={`Chi tiết Bill #${bill.id}`}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span
              className={`badge ${bill.parent_bill_id ? "badge-sky" : "badge-slate"}`}
            >
              {bill.parent_bill_id ? "Bill con" : "Bill chính"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {formatDate(bill.date)}
            </span>
            <span
              className={`badge gap-1.5 ${
                allPaid
                  ? "badge-emerald"
                  : hasPaidPlayers
                    ? "badge-amber"
                    : "badge-slate"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  allPaid
                    ? "bg-emerald-500"
                    : hasPaidPlayers
                      ? "bg-amber-500"
                      : "bg-slate-400"
                }`}
                aria-hidden
              />
              {allPaid
                ? "Đã thanh toán"
                : hasPaidPlayers
                  ? "Thanh toán 1 phần"
                  : "Chưa thanh toán"}
            </span>
          </span>
        }
        actions={
          <>
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
            {!hasPaidPlayers && (
              <button
                type="button"
                onClick={() => navigate(`/bills/${id}/edit`)}
                className="btn btn-secondary flex-1 sm:flex-none"
              >
                <Pencil className="h-4 w-4" />
                Sửa bill
              </button>
            )}
            {!bill.parent_bill_id && (
              <button
                type="button"
                onClick={() => navigate(`/bills/create?parent_id=${id}`)}
                className="btn btn-secondary flex-1 sm:flex-none"
              >
                <Plus className="h-4 w-4" />
                Bill con
              </button>
            )}
            <button
              type="button"
              onClick={handleDeleteClick}
              aria-label="Xóa bill"
              className="btn btn-danger-soft btn-icon shrink-0"
            >
              <Trash2 className="h-[18px] w-[18px]" />
            </button>
          </>
        }
      />

      {/* Layout 2 cột nếu có sub-bills, 1 cột nếu không */}
      {!bill.parent_bill_id && bill.sub_bills && bill.sub_bills.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2 lg:h-[calc(100vh-200px)]">
          {/* Cột trái: Bill chính */}
          <section className="flex flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-card ring-1 ring-emerald-50">
            <div className="border-b border-emerald-100 bg-emerald-50/60 px-4 py-3 sm:px-5 sm:py-4">
              <p className="text-sm font-medium text-emerald-700">Bill chính</p>
              <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
                #{bill.id}
              </h3>
            </div>
            <div className="flex-1 p-3 sm:p-4 lg:min-h-0 lg:overflow-y-auto">
              <BillContent
                bill={bill}
                showHeader={false}
                onMarkPayment={handleMarkPayment}
                isMainBill={true}
                subBills={bill.sub_bills}
              />
            </div>
          </section>

          {/* Cột phải: Bill con */}
          <div className="space-y-3 sm:space-y-4 lg:overflow-y-auto">
            {bill.sub_bills.map((subBill) => (
              <section
                key={subBill.id}
                className="overflow-hidden rounded-2xl border border-sky-200 bg-white shadow-card ring-1 ring-sky-50"
              >
                <div className="border-b border-sky-100 bg-sky-50/60 px-4 py-3 sm:px-5 sm:py-4">
                  <p className="text-sm font-medium text-sky-700">Bill con</p>
                  <h3 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
                    #{subBill.id}
                    {subBill.note ? (
                      <span className="ml-2 text-sm font-medium text-slate-500">
                        — {subBill.note}
                      </span>
                    ) : null}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDate(subBill.date)}
                  </p>
                </div>
                <div className="p-3 sm:p-4">
                  <BillContent bill={subBill} showHeader={false} />
                </div>
              </section>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Bill Info và Shuttles */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:gap-4 lg:grid-cols-10">
            {/* Bill Info - 6 phần */}
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:col-span-6">
              <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                <h2 className="text-base font-semibold text-slate-900">
                  Thông tin Bill
                </h2>
              </div>
              <div className="p-4 sm:p-5">
                {(() => {
                  const sumRatios = (bill.bill_players || []).reduce(
                    (sum, p) => {
                      const ratio = p.ratio_value ?? 1.0;
                      return sum + Number(ratio);
                    },
                    0,
                  );
                  const totalAmount = Number(bill.total_amount || 0);
                  const perPersonAmount =
                    sumRatios > 0 ? Math.round(totalAmount / sumRatios) : 0;

                  return (
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 sm:gap-4">
                      <div>
                        <div className="text-xs font-medium text-slate-500">
                          Tiền sân
                        </div>
                        <div className="font-tabular mt-1 text-sm font-semibold text-slate-900 sm:text-lg">
                          {formatCurrencyRounded(bill.court_total)}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-medium text-slate-500">
                          Tiền cầu
                        </div>
                        <div className="font-tabular mt-1 text-sm font-semibold text-slate-900 sm:text-lg">
                          {formatCurrencyRounded(bill.total_shuttle_price)}
                        </div>
                      </div>
                      <div className="sm:order-last">
                        <div className="text-xs font-medium text-slate-500">
                          Tiền/người
                        </div>
                        <div className="font-tabular mt-1 text-sm font-semibold text-slate-900 sm:text-lg">
                          {formatCurrencyRounded(perPersonAmount)}
                        </div>
                      </div>
                      <div className="col-span-3 rounded-xl bg-emerald-50 p-3 sm:order-3 sm:col-span-1">
                        <div className="text-xs font-medium text-emerald-700">
                          Tổng tiền
                        </div>
                        <div className="font-tabular mt-1 text-2xl font-semibold tracking-tight text-emerald-700">
                          {formatCurrencyRounded(bill.total_amount)}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                {bill.note && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-sm">
                    <div className="mb-0.5 text-xs font-medium text-amber-800">
                      Ghi chú
                    </div>
                    <div className="break-words text-slate-700">{bill.note}</div>
                  </div>
                )}
              </div>
            </section>

            {/* Shuttles - 4 phần */}
            {bill.bill_shuttles && bill.bill_shuttles.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:col-span-4">
                <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
                  <h2 className="text-base font-semibold text-slate-900">
                    Chi tiết cầu
                  </h2>
                </div>
                <div className="overflow-x-auto p-2 sm:p-3">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="text-xs font-medium text-slate-500">
                        <th className="px-2 pb-2 text-left">Loại cầu</th>
                        <th className="px-2 pb-2 text-right">SL</th>
                        <th className="px-2 pb-2 text-right">Đơn giá</th>
                        <th className="px-2 pb-2 text-right">Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bill.bill_shuttles.map((shuttle, index) => (
                        <tr key={index}>
                          <td className="px-2 py-2 text-slate-700">
                            {shuttle.shuttle_type?.name}
                          </td>
                          <td className="font-tabular px-2 py-2 text-right text-slate-700">
                            {shuttle.quantity}
                          </td>
                          <td className="font-tabular px-2 py-2 text-right text-slate-700">
                            {formatCurrencyRounded(shuttle.price_each)}
                          </td>
                          <td className="font-tabular px-2 py-2 text-right font-semibold text-slate-900">
                            {formatCurrencyRounded(shuttle.subtotal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </div>

          {/* Players Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-4">
              <h2 className="text-base font-semibold text-slate-900">
                Chi tiết người chơi
              </h2>
              <span className="font-tabular text-sm text-slate-500">
                {bill.bill_players?.length || 0} người
              </span>
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left">
                      STT
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-left">
                      Tên
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Mức tính
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Chi phí thêm
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Tiền nợ
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-right">
                      Tổng tiền
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-center">
                      Đã thanh toán
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(() => {
                    // Sort players: unpaid males -> unpaid females -> paid males -> paid females
                    const sortedPlayers = [...(bill.bill_players || [])].sort(
                      (a, b) => {
                        const aIsPaid = a.is_paid || false;
                        const bIsPaid = b.is_paid || false;
                        const aGender = a.user?.gender || "";
                        const bGender = b.user?.gender || "";

                        // First sort by payment status: unpaid first (false < true)
                        if (aIsPaid !== bIsPaid) {
                          return aIsPaid ? 1 : -1;
                        }

                        // If same payment status, sort by gender: male first
                        if (aGender !== bGender) {
                          if (aGender === "male") return -1;
                          if (bGender === "male") return 1;
                        }

                        return 0;
                      },
                    );

                    return sortedPlayers.map((player, index) => (
                      <tr
                        key={player.id}
                        className={`align-top ${!player.is_paid ? "bg-rose-50" : ""}`}
                      >
                        <td className="font-tabular px-4 py-3">{index + 1}</td>
                        <td className="max-w-[16rem] break-words px-4 py-3 font-medium text-slate-900">
                          {player.user?.name}
                        </td>
                        <td className="font-tabular px-4 py-3 text-right">
                          {formatRatio(player.ratio_value)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {player.bill_player_menus &&
                          player.bill_player_menus.length > 0 ? (
                            <div className="text-right">
                              <div className="font-tabular mb-1 font-semibold">
                                {formatCurrencyRounded(
                                  player.menu_extra_total || 0,
                                )}
                              </div>
                              <div className="space-y-1 text-xs text-slate-500">
                                {player.bill_player_menus.map(
                                  (menuItem, idx) => (
                                    <div key={idx} className="text-right">
                                      {menuItem.menu?.name} ×{" "}
                                      {menuItem.quantity} ={" "}
                                      {formatCurrency(menuItem.subtotal)}
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {player.debt_amount > 0 ? (
                            <div>
                              <div className="font-tabular mb-1 font-semibold text-amber-800">
                                {formatCurrencyRounded(player.debt_amount)}
                              </div>
                              {player.debt_details &&
                                player.debt_details.length > 0 && (
                                  <div className="space-y-2 text-xs text-slate-600">
                                    {player.debt_details.map((debt, idx) => (
                                      <div
                                        key={idx}
                                        className="rounded-lg border border-amber-200 bg-amber-50/60 p-1.5 text-right"
                                      >
                                        {debt.parent_amount !== null && (
                                          <div className="font-medium">
                                            {formatDateDisplay(debt.date)}:{" "}
                                            {formatCurrencyRounded(
                                              debt.parent_amount,
                                            )}
                                          </div>
                                        )}
                                        {debt.sub_bills &&
                                          debt.sub_bills.length > 0 &&
                                          debt.sub_bills.map(
                                            (subBill, subIdx) => (
                                              <div
                                                key={subIdx}
                                                className="mt-0.5 pl-2"
                                              >
                                                {subBill.note || "Bill con"}:{" "}
                                                {formatCurrencyRounded(
                                                  subBill.amount,
                                                )}
                                              </div>
                                            ),
                                          )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="font-tabular px-4 py-3 text-right font-semibold text-emerald-700">
                          {formatCurrencyRounded(
                            (player.total_amount || 0) +
                              (player.debt_amount || 0),
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={player.is_paid || false}
                            aria-label={`Đã thanh toán: ${player.user?.name || ""}`}
                            onChange={(e) => {
                              // Nếu đang uncheck, prevent default và hiển thị dialog
                              if (player.is_paid && !e.target.checked) {
                                e.preventDefault();
                                handleMarkPayment(player.user_id, false);
                              } else {
                                // Nếu đang check, cho phép update ngay
                                handleMarkPayment(
                                  player.user_id,
                                  e.target.checked,
                                );
                              }
                            }}
                            className="h-5 w-5 cursor-pointer accent-emerald-700"
                          />
                          {player.paid_at && (
                            <div className="font-tabular mt-1 text-xs text-slate-500">
                              {new Date(player.paid_at).toLocaleString("vi-VN")}
                            </div>
                          )}
                        </td>
                      </tr>
                    ));
                  })()}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 font-bold text-slate-900">
                    <td colSpan="5" className="px-4 py-3 text-right">
                      Tổng cộng:
                    </td>
                    <td className="font-tabular px-4 py-3 text-right">
                      {formatCurrencyRounded(
                        bill.bill_players?.reduce(
                          (sum, p) =>
                            sum + (p.total_amount || 0) + (p.debt_amount || 0),
                          0,
                        ) || 0,
                      )}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden space-y-2.5 p-3">
              {(() => {
                const sortedPlayers = [...(bill.bill_players || [])].sort(
                  (a, b) => {
                    const aIsPaid = a.is_paid || false;
                    const bIsPaid = b.is_paid || false;
                    const aGender = a.user?.gender || "";
                    const bGender = b.user?.gender || "";
                    if (aIsPaid !== bIsPaid) return aIsPaid ? 1 : -1;
                    if (aGender !== bGender) {
                      if (aGender === "male") return -1;
                      if (bGender === "male") return 1;
                    }
                    return 0;
                  },
                );

                return sortedPlayers.map((player, index) => {
                  const total =
                    (player.total_amount || 0) + (player.debt_amount || 0);
                  return (
                    <article
                      key={player.id}
                      className={`overflow-hidden rounded-xl border transition ${
                        player.is_paid
                          ? "border-emerald-200 bg-emerald-50/40"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start gap-2">
                              <span className="font-tabular mt-0.5 inline-flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 px-1.5 text-xs font-medium text-slate-600">
                                {index + 1}
                              </span>
                              <h4 className="break-words font-semibold text-slate-900">
                                {player.user?.name}
                              </h4>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                              <span>Mức tính</span>
                              <span className="font-tabular font-medium text-slate-700">
                                {formatRatio(player.ratio_value)}
                              </span>
                              {player.user?.gender === "female" && (
                                <span className="rounded-full bg-pink-100 px-1.5 py-0.5 text-xs font-medium text-pink-700">
                                  Nữ
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-tabular text-xl font-semibold tracking-tight text-slate-900">
                              {formatCurrencyRounded(total)}
                            </div>
                            <label className="mt-1.5 inline-flex h-11 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition cursor-pointer select-none active:scale-95 has-[:checked]:border-emerald-300 has-[:checked]:bg-emerald-100 has-[:checked]:text-emerald-800 border-slate-200 bg-white text-slate-600">
                              <input
                                type="checkbox"
                                checked={player.is_paid || false}
                                onChange={(e) => {
                                  if (player.is_paid && !e.target.checked) {
                                    e.preventDefault();
                                    handleMarkPayment(player.user_id, false);
                                  } else {
                                    handleMarkPayment(
                                      player.user_id,
                                      e.target.checked,
                                    );
                                  }
                                }}
                                className="sr-only"
                              />
                              {player.is_paid ? (
                                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                              ) : (
                                <Circle className="h-3.5 w-3.5" strokeWidth={2.5} />
                              )}
                              {player.is_paid ? "Đã thanh toán" : "Đánh dấu TT"}
                            </label>
                          </div>
                        </div>

                        {player.bill_player_menus &&
                          player.bill_player_menus.length > 0 && (
                            <div className="mt-3 rounded-lg bg-slate-50 p-2.5">
                              <div className="flex items-baseline justify-between gap-2">
                                <span className="text-xs font-medium text-slate-500">
                                  Chi phí thêm
                                </span>
                                <span className="font-tabular text-sm font-semibold text-slate-900">
                                  {formatCurrencyRounded(
                                    player.menu_extra_total || 0,
                                  )}
                                </span>
                              </div>
                              <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                                {player.bill_player_menus.map(
                                  (menuItem, idx) => (
                                    <div
                                      key={idx}
                                      className="flex justify-between"
                                    >
                                      <span>
                                        {menuItem.menu?.name} ×{" "}
                                        {menuItem.quantity}
                                      </span>
                                      <span className="font-tabular">
                                        {formatCurrency(menuItem.subtotal)}
                                      </span>
                                    </div>
                                  ),
                                )}
                              </div>
                            </div>
                          )}

                        {player.debt_amount > 0 && (
                          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/60 p-2.5">
                            <div className="flex items-baseline justify-between gap-2">
                              <span className="text-xs font-medium text-amber-800">
                                Tiền nợ
                              </span>
                              <span className="font-tabular text-sm font-semibold text-amber-800">
                                {formatCurrencyRounded(player.debt_amount)}
                              </span>
                            </div>
                            {player.debt_details &&
                              player.debt_details.length > 0 && (
                                <div className="mt-1.5 space-y-1 text-xs text-slate-600">
                                  {player.debt_details.map((debt, idx) => (
                                    <div
                                      key={idx}
                                      className="rounded-md border border-amber-100 bg-white/60 p-1.5"
                                    >
                                      {debt.parent_amount !== null && (
                                        <div className="flex justify-between">
                                          <span className="font-medium text-slate-700">
                                            {formatDateDisplay(debt.date)}
                                          </span>
                                          <span className="font-tabular">
                                            {formatCurrencyRounded(
                                              debt.parent_amount,
                                            )}
                                          </span>
                                        </div>
                                      )}
                                      {debt.sub_bills &&
                                        debt.sub_bills.length > 0 &&
                                        debt.sub_bills.map(
                                          (subBill, subIdx) => (
                                            <div
                                              key={subIdx}
                                              className="flex justify-between pl-2 text-[11px]"
                                            >
                                              <span>
                                                {subBill.note || "Bill con"}
                                              </span>
                                              <span className="font-tabular">
                                                {formatCurrencyRounded(
                                                  subBill.amount,
                                                )}
                                              </span>
                                            </div>
                                          ),
                                        )}
                                    </div>
                                  ))}
                                </div>
                              )}
                          </div>
                        )}

                        {player.paid_at && (
                          <div className="mt-2 flex items-center gap-1 text-[11px] text-emerald-700">
                            <Clock className="h-3 w-3" strokeWidth={2.5} />
                            {new Date(player.paid_at).toLocaleString("vi-VN")}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                });
              })()}

              {/* Total Summary */}
              <div className="mt-2 rounded-xl bg-emerald-50/70 px-3 py-2.5">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-medium text-emerald-700">
                    Tổng cộng
                  </span>
                  <span className="font-tabular text-xl font-semibold tracking-tight text-emerald-700">
                    {formatCurrencyRounded(
                      bill.bill_players?.reduce(
                        (sum, p) =>
                          sum + (p.total_amount || 0) + (p.debt_amount || 0),
                        0,
                      ) || 0,
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Parent Bill Info - Only show if this is a sub-bill */}
      {bill.parent_bill_id && bill.parent_bill && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/40 shadow-card sm:mt-6">
          <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <div className="min-w-0 flex-1">
              <span className="badge badge-sky">Bill con của</span>
              <h2 className="mt-1.5 text-lg font-semibold tracking-tight text-slate-900">
                Bill chính #{bill.parent_bill.id}
              </h2>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  {formatDate(bill.parent_bill.date)}
                </span>
                <span className="font-tabular font-semibold text-slate-700">
                  {formatCurrencyRounded(bill.parent_bill.total_amount)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate(`/bills/${bill.parent_bill.id}`)}
              className="btn btn-secondary"
            >
              Xem Bill chính
              <ChevronLeft className="h-4 w-4 rotate-180" />
            </button>
          </div>
        </section>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa bill"
        message="Bạn có chắc chắn muốn xóa bill này? Hành động này không thể hoàn tác."
      />

      <ConfirmDialog
        isOpen={uncheckPaymentConfirm.isOpen}
        onClose={handleUncheckPaymentCancel}
        onConfirm={handleUncheckPaymentConfirm}
        title="Xác nhận hủy thanh toán"
        message={`Bạn có chắc chắn muốn hủy trạng thái "Đã thanh toán" cho ${uncheckPaymentConfirm.playerName}?`}
      />

      <PayOldBillsDialog
        isOpen={payOldBillsConfirm.isOpen}
        onClose={() =>
          setPayOldBillsConfirm({
            isOpen: false,
            playerId: null,
            playerName: "",
            debtAmount: 0,
            oldBillIds: [],
          })
        }
        onPayCurrentOnly={handlePayOldBillsCancel}
        onPayAll={handlePayOldBillsConfirm}
        playerName={payOldBillsConfirm.playerName}
        debtAmount={payOldBillsConfirm.debtAmount}
      />

      {/* Hidden export component — always rendered when bill is loaded so
          layout/styles are committed before the user clicks Export. html-to-image
          snapshots the target node directly via SVG foreignObject, so wrapper
          position does not affect capture. */}
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
            <BillExport
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

      <SelectPaymentAccountDialog
        isOpen={selectAccountDialog.isOpen}
        onClose={handleSelectAccountCancel}
        onConfirm={handleSelectAccountConfirm}
        paymentAccounts={paymentAccounts}
      />
    </div>
  );
}
