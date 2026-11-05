import { useState, useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { billsApi, shuttlesApi } from "../../services/api";
import {
  formatCurrencyRounded,
  formatDate,
} from "../../utils/formatters";
import {
  BILL_PAGE_SIZE,
  buildBillEntries,
  collectUnpaidPlayers,
  dateRangeLabel,
  groupEntriesByMonth,
  isBillOverdue,
  isPlayerOverdue,
  matchesStatusFilter,
  takeEntries,
} from "../../utils/billList";
import {
  formatShuttleStock,
  LOW_STOCK_BALLS,
  LOW_STOCK_TUBES,
} from "../../utils/shuttleStock";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import useToast from "../../components/ui/useToast";
import {
  ChartLine,
  Check,
  ChevronLeft,
  CircleAlert,
  Plus,
  Receipt,
  SlidersHorizontal,
  Trash2,
  X,
} from "../../components/ui/icons";
import { useAuth } from "../../contexts/AuthContext";
import BillFilterSheet from "../../components/dashboard/BillFilterSheet";
import DashboardSummary from "../../components/dashboard/DashboardSummary";
import MobileBillList, {
  MobileBillListSkeleton,
} from "../../components/dashboard/MobileBillList";
import ShuttleStockSheet from "../../components/dashboard/ShuttleStockSheet";
import StatsSheet from "../../components/dashboard/StatsSheet";
import UnpaidPlayersSheet from "../../components/dashboard/UnpaidPlayersSheet";

const EMPTY_FILTERS = {
  date_from: "",
  date_to: "",
  player_id: "",
  status: [],
  limit: 10,
};

// Chip trạng thái trên điện thoại (thứ tự theo bản vẽ: việc cần thu trước)
const STATUS_CHIPS = [
  { value: "partial", label: "1 phần" },
  { value: "unpaid", label: "Chưa TT" },
  { value: "paid", label: "Đã TT" },
];

export default function Dashboard() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [bills, setBills] = useState([]);
  const [allBills, setAllBills] = useState([]); // Store all bills for unpaid players calculation
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Đổi bộ lọc nhanh (vd Từ ngày rồi Đến ngày) gửi nhiều lần tải: chỉ nhận kết quả của lần mới nhất
  const loadSeqRef = useRef(0);
  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    player_id: "",
    status: ["partial", "unpaid"], // Array of selected statuses: 'paid', 'partial', 'unpaid'
    limit: 10, // Limit number of main bills to display
  });
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    billId: null,
  });
  const [markingPayment, setMarkingPayment] = useState(new Set()); // Track players being marked as paid
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(BILL_PAGE_SIZE); // Điện thoại: "Xem thêm" thay phân trang
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  // Thống kê không theo bộ lọc ngày: khi đang lọc ngày (hoặc danh sách lỗi) thì tải riêng mọi bill
  const [statsData, setStatsData] = useState({ status: "idle", bills: [] });
  const [shuttleTypes, setShuttleTypes] = useState([]);
  const [loadingShuttles, setLoadingShuttles] = useState(true);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [unpaidSheetOpen, setUnpaidSheetOpen] = useState(false);
  const [stockSheetOpen, setStockSheetOpen] = useState(false);
  // "Đã trả hết": người đang chờ xác nhận, đang gọi API (kết quả: thông báo ngắn M8)
  const [payAllTarget, setPayAllTarget] = useState(null);
  const [payAllBusy, setPayAllBusy] = useState(false);

  useEffect(() => {
    loadBills();
    setCurrentPage(1); // Reset to page 1 when filters change
    setVisibleCount(BILL_PAGE_SIZE);
  }, [filters]);

  useEffect(() => {
    const loadShuttleTypes = async () => {
      try {
        setLoadingShuttles(true);
        const res = await shuttlesApi.getAll();
        const list = res.data || [];
        list.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
        setShuttleTypes(list);
      } catch (e) {
        console.error("Error loading shuttle types:", e);
      } finally {
        setLoadingShuttles(false);
      }
    };
    loadShuttleTypes();
  }, []);

  // Adjust currentPage if it exceeds totalPages (e.g., when limit changes)
  useEffect(() => {
    const mainBills = bills.filter((bill) => !bill.parent_bill_id);
    const totalPagesCount = Math.ceil(mainBills.length / filters.limit);
    if (currentPage > totalPagesCount && totalPagesCount > 0) {
      setCurrentPage(totalPagesCount);
    }
  }, [bills, filters.limit, currentPage]);

  const loadBills = async () => {
    const seq = ++loadSeqRef.current;
    try {
      setLoading(true);
      setLoadError(false);
      const params = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.player_id) params.player_id = filters.player_id;

      const response = await billsApi.getAll(params);
      if (seq !== loadSeqRef.current) return;
      let filteredBills = response.data;

      // Store all bills for unpaid players calculation (without status filter)
      setAllBills(response.data);

      // Filter by status on frontend (multiple statuses can be selected)
      filteredBills = filteredBills.filter((bill) =>
        matchesStatusFilter(bill, filters.status),
      );

      setBills(filteredBills);
    } catch (error) {
      if (seq !== loadSeqRef.current) return;
      console.error("Error loading bills:", error);
      setLoadError(true);
      setBills([]);
      setAllBills([]);
    } finally {
      if (seq === loadSeqRef.current) setLoading(false);
    }
  };

  const getStatusColor = (bill) => {
    const allPaid = bill.bill_players?.every((p) => p.is_paid);
    const somePaid = bill.bill_players?.some((p) => p.is_paid);

    if (allPaid) return "bg-emerald-50 text-emerald-800";
    if (somePaid) return "bg-amber-50 text-amber-800";
    return "bg-slate-100 text-slate-700";
  };

  const getStatusText = (bill) => {
    const allPaid = bill.bill_players?.every((p) => p.is_paid);
    const somePaid = bill.bill_players?.some((p) => p.is_paid);

    if (allPaid) return "Đã thanh toán";
    if (somePaid) return "Thanh toán 1 phần";
    return "Chưa thanh toán";
  };

  const handleDeleteClick = (billId) => {
    setDeleteConfirm({ isOpen: true, billId });
  };

  const deleteBill = async (billId) => {
    try {
      await billsApi.delete(billId);
      setDeleteConfirm({ isOpen: false, billId: null });
      loadBills(); // Reload bills after deletion
    } catch (error) {
      console.error("Error deleting bill:", error);
      setDeleteConfirm({ isOpen: false, billId: null });
      toast.error("Có lỗi xảy ra khi xóa bill", {
        onRetry: () => deleteBill(billId),
      });
    }
  };

  const handleDeleteConfirm = () => deleteBill(deleteConfirm.billId);

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, billId: null });
  };

  // Mark payment for all unpaid bills of a player (lỗi ném ra cho nơi gọi báo)
  const handleMarkPlayerPayment = async (userId) => {
    try {
      setMarkingPayment((prev) => new Set(prev).add(userId));

      // Find all bills where this player hasn't paid
      const unpaidBills = allBills.filter((bill) => {
        const player = bill.bill_players?.find((p) => p.user_id === userId);
        return player && !player.is_paid;
      });

      // Mark payment for all unpaid bills
      const promises = unpaidBills.map(async (bill) => {
        try {
          const player = bill.bill_players?.find((p) => p.user_id === userId);
          if (player) {
            await billsApi.markPayment(bill.id, userId, {
              amount: (player.total_amount || 0) + (player.debt_amount || 0),
              is_paid: true,
            });
          }
        } catch (error) {
          console.error(`Error marking payment for bill ${bill.id}:`, error);
          throw error; // Re-throw to handle in outer catch
        }
      });

      await Promise.all(promises);

      // Update state directly without reloading
      setAllBills((prevBills) => {
        return prevBills.map((bill) => {
          const playerIndex = bill.bill_players?.findIndex(
            (p) => p.user_id === userId,
          );
          if (playerIndex !== undefined && playerIndex !== -1) {
            const updatedBill = { ...bill };
            updatedBill.bill_players = [...(bill.bill_players || [])];
            updatedBill.bill_players[playerIndex] = {
              ...updatedBill.bill_players[playerIndex],
              is_paid: true,
            };
            return updatedBill;
          }
          return bill;
        });
      });

      setBills((prevBills) => {
        return prevBills.map((bill) => {
          const playerIndex = bill.bill_players?.findIndex(
            (p) => p.user_id === userId,
          );
          if (playerIndex !== undefined && playerIndex !== -1) {
            const updatedBill = { ...bill };
            updatedBill.bill_players = [...(bill.bill_players || [])];
            updatedBill.bill_players[playerIndex] = {
              ...updatedBill.bill_players[playerIndex],
              is_paid: true,
            };
            return updatedBill;
          }
          return bill;
        });
      });
    } catch (error) {
      console.error("Error marking player payment:", error);
      throw error;
    } finally {
      setMarkingPayment((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  /**
   * "Đã trả hết" sau khi xác nhận: kết quả là thông báo ngắn (M8), kể cả khi đang mở sheet DS chưa
   * thanh toán (thông báo nằm trên lớp nền của sheet, lên đỉnh màn).
   */
  const markPlayerPaid = async (player) => {
    try {
      await handleMarkPlayerPayment(player.userId);
      toast.success(`Đã đánh dấu ${player.name} trả hết`);
    } catch {
      toast.error("Có lỗi xảy ra khi đánh dấu thanh toán", {
        onRetry: () => markPlayerPaid(player),
      });
    }
  };

  const confirmPayAll = async () => {
    const player = payAllTarget;
    setPayAllBusy(true);
    await markPlayerPaid(player);
    setPayAllBusy(false);
    setPayAllTarget(null);
  };

  // Format date to YYYY/MM/DD
  const formatDateForUnpaid = (date) => {
    if (!date) return "";
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}/${month}/${day}`;
  };

  // Calculate unpaid players list
  const unpaidPlayers = useMemo(() => collectUnpaidPlayers(allBills), [allBills]);
  const unpaidTotal = unpaidPlayers.reduce((sum, p) => sum + p.totalAmount, 0);

  /** Chỉ loại còn tồn trên 0 quả (0 hoặc âm không hiển thị). */
  const shuttleTypesWithStock = useMemo(
    () => shuttleTypes.filter((s) => (Number(s.stock_quantity) || 0) > 0),
    [shuttleTypes],
  );

  const totalShuttleStockBalls = useMemo(
    () =>
      shuttleTypesWithStock.reduce(
        (sum, s) => sum + (Number(s.stock_quantity) || 0),
        0,
      ),
    [shuttleTypesWithStock],
  );

  /** Tổng tồn của tất cả loại cầu (kể cả loại đã về 0/âm). */
  const totalAllShuttleBalls = useMemo(
    () =>
      shuttleTypes.reduce((sum, s) => sum + (Number(s.stock_quantity) || 0), 0),
    [shuttleTypes],
  );
  const isTotalLowStock = totalAllShuttleBalls < LOW_STOCK_BALLS;

  // Calculate displayed bills and total main bills count
  const { billGroups, totalMainBillsCount, totalPages } = useMemo(() => {
    // Sort all bills by date descending (newest first)
    const sortedBills = [...bills].sort((a, b) => {
      const dateA = a.date ? new Date(a.date) : new Date(0);
      const dateB = b.date ? new Date(b.date) : new Date(0);
      return dateB - dateA; // Descending order (newest first)
    });

    // Separate main bills and sub bills (after sorting)
    const mainBills = sortedBills.filter((bill) => !bill.parent_bill_id);
    const subBills = sortedBills.filter((bill) => bill.parent_bill_id);

    // Calculate total pages
    const totalPagesCount = Math.ceil(mainBills.length / filters.limit);

    // Calculate pagination: get main bills for current page
    const startIndex = (currentPage - 1) * filters.limit;
    const endIndex = startIndex + filters.limit;
    const paginatedMainBills = mainBills.slice(startIndex, endIndex);

    // Get all sub bills that belong to the paginated main bills
    const mainBillIds = new Set(paginatedMainBills.map((bill) => bill.id));
    const relatedSubBills = subBills.filter((bill) =>
      mainBillIds.has(bill.parent_bill_id),
    );

    // Group sub bills by parent bill ID
    const subBillsByParent = new Map();
    relatedSubBills.forEach((subBill) => {
      const parentId = subBill.parent_bill_id;
      if (!subBillsByParent.has(parentId)) {
        subBillsByParent.set(parentId, []);
      }
      subBillsByParent.get(parentId).push(subBill);
    });

    // Sort sub bills by date (newest first) within each parent group
    subBillsByParent.forEach((subs) => {
      subs.sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateB - dateA;
      });
    });

    // Build bill groups: each group contains main bill and its sub bills
    const groups = paginatedMainBills.map((mainBill) => ({
      mainBill,
      subBills: subBillsByParent.get(mainBill.id) || [],
    }));

    return {
      billGroups: groups,
      totalMainBillsCount: mainBills.length,
      totalPages: totalPagesCount,
    };
  }, [bills, filters.limit, currentPage]);

  // Điện thoại: nhóm theo tháng (bill con mồ côi vẫn hiện), "Xem thêm" thay phân trang
  const monthGroups = useMemo(
    () => groupEntriesByMonth(buildBillEntries(bills)),
    [bills],
  );
  const totalEntries = monthGroups.reduce((sum, g) => sum + g.billCount, 0);
  const visibleGroups = useMemo(
    () => takeEntries(monthGroups, visibleCount),
    [monthGroups, visibleCount],
  );

  const hasDateFilter = Boolean(filters.date_from || filters.date_to);
  // Rỗng vì đang lọc (còn bill bị lọc ra) → "Xóa lọc"; thật sự chưa có bill → "Tạo bill đầu tiên"
  const isFiltered =
    hasDateFilter || (filters.status.length > 0 && allBills.length > 0);
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  const statsUsesOwnData = hasDateFilter || loadError;
  const loadStatsBills = async () => {
    setStatsData({ status: "loading", bills: [] });
    try {
      const response = await billsApi.getAll();
      setStatsData({ status: "ready", bills: response.data });
    } catch (error) {
      console.error("Error loading bills for statistics:", error);
      setStatsData({ status: "error", bills: [] });
    }
  };
  const stats = statsUsesOwnData
    ? statsData
    : { status: loading ? "loading" : "ready", bills: allBills };

  /** Mở thống kê: luôn bắt đầu ở tháng hiện tại (StatsSheet gắn lại mỗi lần mở). */
  const openStatsModal = () => {
    if (statsUsesOwnData) loadStatsBills();
    setStatsModalOpen(true);
  };

  const toggleStatus = (value) => {
    const next = filters.status.includes(value)
      ? filters.status.filter((s) => s !== value)
      : [...filters.status, value];
    setFilters({ ...filters, status: next });
  };

  const emptyState = (
    <EmptyState
      icon={Receipt}
      title="Chưa có bill nào"
      description="Thử xóa bộ lọc hoặc tạo bill mới để bắt đầu."
      action={
        isFiltered ? (
          <button type="button" onClick={clearFilters} className="btn btn-secondary">
            Xóa lọc
          </button>
        ) : (
          hasPermission("bills.create") && (
            <Link to="/bills/create" className="btn btn-primary">
              <Plus className="h-4 w-4" />
              Tạo bill đầu tiên
            </Link>
          )
        )
      }
    />
  );

  return (
    <div className="px-4 sm:px-0">
      <PageHeader
        compactActions
        hideOnPhone
        title="Bill cầu"
        barAction={
          <button
            type="button"
            onClick={openStatsModal}
            aria-label="Thống kê"
            aria-haspopup="dialog"
            className="app-bar-btn"
          >
            <ChartLine className="h-6 w-6" />
          </button>
        }
        description={
          loading ? (
            <span className="hidden h-3.5 w-24 skeleton align-middle sm:inline-block" />
          ) : (
            <span className="hidden sm:inline">
              <span className="font-tabular font-semibold text-slate-700">
                {bills.length}
              </span>{" "}
              {bills.length === 1 ? "bill" : "bills"} hiển thị
              {filters.date_from || filters.date_to ? " theo bộ lọc" : ""}
            </span>
          )
        }
        actions={
          <>
            <button
              type="button"
              onClick={openStatsModal}
              className="btn btn-secondary hidden px-3 sm:inline-flex sm:px-4"
            >
              <ChartLine className="h-[18px] w-[18px]" />
              Thống kê
            </button>
            {hasPermission("bills.create") && (
              <Link
                to="/bills/create"
                className="btn btn-primary hidden sm:inline-flex"
              >
                <Plus className="h-4 w-4" />
                Tạo Bill
              </Link>
            )}
          </>
        }
      />

      {/* Điện thoại: thanh trên đã có tiêu đề, khối mô tả / nút của PageHeader không dựng (hideOnPhone) */}
      <div>
        {!loadError && (
          <DashboardSummary
            unpaidTotal={unpaidTotal}
            unpaidCount={unpaidPlayers.length}
            stockBalls={totalShuttleStockBalls}
            lowStock={isTotalLowStock}
            loadingBills={loading}
            loadingShuttles={loadingShuttles}
            dateFiltered={hasDateFilter}
            onOpenUnpaid={() => setUnpaidSheetOpen(true)}
            onOpenStock={() => setStockSheetOpen(true)}
          />
        )}

        {/* Lọc trên điện thoại (M4): "Lọc" ghim trái mở sheet khoảng ngày, chip trạng thái cuộn ngang */}
        <div className="chip-bar mb-3 md:hidden">
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-haspopup="dialog"
            aria-label={hasDateFilter ? "Lọc (1)" : undefined}
            className="chip"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Lọc
            {hasDateFilter && <span className="chip-count">1</span>}
          </button>
          <div className="chip-row">
            {hasDateFilter && (
              <span className="chip chip-applied">
                {dateRangeLabel(filters.date_from, filters.date_to)}
                <button
                  type="button"
                  onClick={() => setFilters({ ...filters, date_from: "", date_to: "" })}
                  aria-label="Bỏ lọc ngày"
                  className="chip-remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </span>
            )}
            {STATUS_CHIPS.map((chip) => (
              <button
                key={chip.value}
                type="button"
                aria-pressed={filters.status.includes(chip.value)}
                onClick={() => toggleStatus(chip.value)}
                className="chip"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Filters — toolbar gọn 1 hàng trên desktop */}
      <section aria-label="Lọc danh sách bills" className="card mb-3 hidden !p-2 sm:mb-6 sm:!p-4 md:block">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-5 lg:gap-y-3">
          {/* Dates */}
          <div id="bill-filter-dates" className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:flex">
            <div className="min-w-0">
              <label htmlFor="filter-date-from" className="field-label">
                Từ ngày
              </label>
              <input
                id="filter-date-from"
                type="date"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters({ ...filters, date_from: e.target.value })
                }
                className="field-input min-w-0 lg:w-40"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="filter-date-to" className="field-label">
                Đến ngày
              </label>
              <input
                id="filter-date-to"
                type="date"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters({ ...filters, date_to: e.target.value })
                }
                className="field-input min-w-0 lg:w-40"
              />
            </div>
          </div>

          {/* Status chips */}
          <div role="group" aria-labelledby="filter-status-label" className="order-first sm:order-none">
            <span id="filter-status-label" className="sr-only sm:not-sr-only sm:field-label">
              Trạng thái
            </span>
            <div className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-1 sm:flex sm:flex-wrap sm:gap-2">
              {[
                {
                  value: "paid",
                  short: "Đã TT",
                  label: "Đã thanh toán",
                  activeCls:
                    "border-emerald-300 bg-emerald-50 text-emerald-800",
                  dotCls: "bg-emerald-500",
                },
                {
                  value: "partial",
                  short: "1 phần",
                  label: "Thanh toán 1 phần",
                  activeCls: "border-amber-300 bg-amber-50 text-amber-800",
                  dotCls: "bg-amber-500",
                },
                {
                  value: "unpaid",
                  short: "Chưa TT",
                  label: "Chưa thanh toán",
                  activeCls: "border-slate-300 bg-slate-100 text-slate-800",
                  dotCls: "bg-slate-400",
                },
              ].map((opt) => {
                const isActive = filters.status.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-label={opt.label}
                    aria-pressed={isActive}
                    onClick={() => toggleStatus(opt.value)}
                    className={`inline-flex h-11 items-center justify-center gap-1 whitespace-nowrap rounded-lg border px-1 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-1 sm:h-10 sm:gap-2 sm:rounded-full sm:px-3.5 sm:text-sm ${
                      isActive
                        ? opt.activeCls
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${opt.dotCls}`}
                      aria-hidden
                    />
                    <span className="sm:hidden">{opt.short}</span>
                    <span className="hidden sm:inline">{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Limit + Clear — đẩy sang phải trên desktop */}
          <div id="bill-filter-options" className="grid grid-cols-2 gap-2 sm:gap-3 lg:ml-auto lg:flex lg:items-end">
            <div>
              <label htmlFor="filter-limit" className="field-label">
                Số bill / trang
              </label>
              <select
                id="filter-limit"
                value={filters.limit}
                onChange={(e) =>
                  setFilters({ ...filters, limit: parseInt(e.target.value) })
                }
                className="field-input font-medium lg:w-24"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={30}>30</option>
                <option value={40}>40</option>
                <option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={clearFilters}
                className="btn btn-secondary w-full lg:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                <span className="sm:hidden">Xóa lọc</span>
                <span className="hidden sm:inline">Xóa bộ lọc</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content: Bills Table and Unpaid Players */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Bills Table - Left Side (3/4 width) */}
        <div className="lg:col-span-3">
          {loading ? (
            <>
            <MobileBillListSkeleton className="md:hidden" />
            <div className="hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-card md:block">
              <div className="hidden md:block">
                <div className="grid grid-cols-6 gap-3 border-b border-slate-100 px-4 py-3">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="skeleton h-3 w-20" />
                  ))}
                </div>
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-6 items-center gap-3 border-b border-slate-50 px-4 py-4 last:border-0"
                  >
                    {[...Array(6)].map((_, j) => (
                      <div
                        key={j}
                        className="skeleton h-4"
                        style={{ width: `${50 + ((i * j) % 4) * 12}%` }}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
            </>
          ) : loadError ? (
            <EmptyState
              tone="error"
              title="Không tải được danh sách bill"
              description="Kiểm tra mạng rồi thử lại."
              onRetry={loadBills}
            />
          ) : (
            <>
            <div className="md:hidden">
              {totalEntries === 0 ? (
                emptyState
              ) : (
                <MobileBillList
                  groups={visibleGroups}
                  shownCount={Math.min(visibleCount, totalEntries)}
                  totalCount={totalEntries}
                  pageSize={BILL_PAGE_SIZE}
                  onShowMore={() => setVisibleCount((count) => count + BILL_PAGE_SIZE)}
                  canView={hasPermission("bills.view")}
                />
              )}
            </div>
            {billGroups.length === 0 ? (
              <div className="hidden md:block">{emptyState}</div>
            ) : (
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:block">
              <div className="hidden md:block">
                <table className="min-w-full">
                  <thead className="bg-slate-50 text-xs font-medium text-slate-500">
                    <tr>
                      <th scope="col" className="px-5 py-3 text-left">
                        Ngày
                      </th>
                      <th scope="col" className="px-5 py-3 text-left">
                        Loại
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Tổng tiền
                      </th>
                      <th scope="col" className="px-5 py-3 text-left">
                        Trạng thái
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Chưa TT
                      </th>
                      <th scope="col" className="px-5 py-3 text-right">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  {billGroups.map((group) => {
                    const mainBill = group.mainBill;
                    const subBills = group.subBills;
                    const mainBillWarning = isBillOverdue(mainBill);
                    const mainBillAllPaid =
                      mainBill.bill_players?.every((p) => p.is_paid) &&
                      mainBill.bill_players?.length > 0;

                    return (
                      <tbody
                        key={mainBill.id}
                        className="border-t border-slate-200 text-sm text-slate-700"
                      >
                        {/* Main Bill Row */}
                        <tr
                          className={
                            mainBillWarning
                              ? "bg-rose-50"
                              : mainBillAllPaid
                                ? "bg-emerald-50/60"
                                : ""
                          }
                        >
                          <td className="whitespace-nowrap px-5 py-3.5 font-tabular text-slate-900">
                            {formatDate(mainBill.date)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <span className="flex items-center gap-2">
                              <span className="badge badge-slate">
                                Bill chính #{mainBill.id}
                              </span>
                              {mainBillWarning && (
                                <span className="badge badge-rose">Quá hạn</span>
                              )}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right font-tabular font-medium text-slate-900">
                            {formatCurrencyRounded(mainBill.total_amount)}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <span className={`badge ${getStatusColor(mainBill)}`}>
                              {getStatusText(mainBill)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5 text-right font-tabular">
                            {mainBill.bill_players?.filter((p) => !p.is_paid)
                              .length || 0}
                          </td>
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <div className="flex justify-end gap-2">
                              {hasPermission("bills.view") && (
                                <Link
                                  to={`/bills/${mainBill.id}`}
                                  className="btn btn-secondary btn-sm"
                                >
                                  Chi tiết
                                </Link>
                              )}
                              {hasPermission("bills.delete") && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(mainBill.id)}
                                  className="btn btn-danger-ghost btn-sm"
                                >
                                  Xóa
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Sub Bills Rows */}
                        {subBills.map((subBill) => {
                          const subBillWarning = isBillOverdue(subBill);
                          const subBillAllPaid =
                            subBill.bill_players?.every((p) => p.is_paid) &&
                            subBill.bill_players?.length > 0;
                          return (
                            <tr
                              key={subBill.id}
                              className={`border-t border-slate-100 ${
                                subBillWarning
                                  ? "bg-rose-50"
                                  : subBillAllPaid
                                    ? "bg-emerald-50/60"
                                    : "bg-sky-50/60"
                              }`}
                            >
                              <td className="whitespace-nowrap border-l-2 border-sky-300 px-5 py-3.5 text-slate-900">
                                {/* {formatDate(subBill.date)} */}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5">
                                <span className="flex items-center gap-2">
                                  <span className="badge badge-sky">Bill con</span>
                                  <span className="text-xs text-slate-500">
                                    của Bill #{mainBill.id}
                                  </span>
                                  {subBillWarning && (
                                    <span className="badge badge-rose">
                                      Quá hạn
                                    </span>
                                  )}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5 text-right font-tabular font-medium text-slate-900">
                                {formatCurrencyRounded(subBill.total_amount)}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5">
                                <span
                                  className={`badge ${getStatusColor(subBill)}`}
                                >
                                  {getStatusText(subBill)}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5 text-right font-tabular">
                                {subBill.bill_players?.filter((p) => !p.is_paid)
                                  .length || 0}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5">
                                <div className="flex justify-end gap-2">
                                  {hasPermission("bills.view") && (
                                    <Link
                                      to={`/bills/${subBill.id}`}
                                      className="btn btn-secondary btn-sm"
                                    >
                                      Chi tiết
                                    </Link>
                                  )}
                                  {hasPermission("bills.delete") && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleDeleteClick(subBill.id)
                                      }
                                      className="btn btn-danger-ghost btn-sm"
                                    >
                                      Xóa
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    );
                  })}
                </table>
              </div>

              {/* Legend/Chú thích */}
              <div className="border-t border-slate-200 bg-slate-50 px-3 py-3 sm:px-6 sm:py-4">
                <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 flex-shrink-0 rounded border border-rose-300 bg-rose-100"></div>
                      <span className="text-xs text-slate-600 sm:text-sm">
                        Bill quá hạn 1 tuần và còn người chưa thanh toán
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 flex-shrink-0 rounded border border-emerald-200 bg-emerald-50"></div>
                      <span className="text-xs text-slate-600 sm:text-sm">
                        Bill đã thanh toán
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="h-4 w-4 flex-shrink-0 rounded border border-sky-200 bg-sky-50"></div>
                      <span className="text-xs text-slate-600 sm:text-sm">
                        Bill con
                      </span>
                    </div>
                  </div>
                  <div className="text-xs font-semibold text-slate-700 sm:text-sm">
                    Tổng số bill: {totalMainBillsCount}
                  </div>
                </div>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-slate-200 px-4 py-4 sm:px-6">
                  <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                    <div className="text-sm text-slate-600">
                      Trang{" "}
                      <span className="font-tabular font-semibold text-slate-900">
                        {currentPage}
                      </span>
                      {" / "}
                      <span className="font-tabular font-semibold text-slate-900">
                        {totalPages}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-1.5">
                      <button
                        onClick={() =>
                          setCurrentPage((prev) => Math.max(1, prev - 1))
                        }
                        disabled={currentPage === 1}
                        aria-label="Trang trước"
                        className="btn btn-secondary gap-1 !px-3"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        <span className="hidden sm:inline">Trước</span>
                      </button>
                      <div className="flex items-center gap-1">
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1,
                        ).map((page) => {
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                aria-current={
                                  currentPage === page ? "page" : undefined
                                }
                                className={`btn min-w-11 font-tabular !px-2 sm:min-w-10 ${
                                  currentPage === page
                                    ? "btn-primary"
                                    : "btn-secondary"
                                }`}
                              >
                                {page}
                              </button>
                            );
                          } else if (
                            page === currentPage - 2 ||
                            page === currentPage + 2
                          ) {
                            return (
                              <span
                                key={page}
                                className="px-1 text-slate-400"
                                aria-hidden
                              >
                                …
                              </span>
                            );
                          }
                          return null;
                        })}
                      </div>
                      <button
                        onClick={() =>
                          setCurrentPage((prev) =>
                            Math.min(totalPages, prev + 1),
                          )
                        }
                        disabled={currentPage === totalPages}
                        aria-label="Trang sau"
                        className="btn btn-secondary gap-1 !px-3"
                      >
                        <span className="hidden sm:inline">Sau</span>
                        <ChevronLeft className="h-4 w-4 rotate-180" />
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
            </>
          )}
        </div>

        {/* Right column: Cầu khả dụng + DS chưa thanh toán (dưới lg: ô tóm tắt + sheet) */}
        <div className="hidden space-y-6 lg:col-span-1 lg:block">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-base font-semibold text-slate-900">
                  Cầu khả dụng
                </h2>
                {hasPermission("shuttles.view") && (
                  <Link
                    to="/master?tab=shuttles"
                    className="-my-2 inline-flex min-h-11 items-center whitespace-nowrap text-sm font-medium text-blue-600 hover:text-blue-800 sm:min-h-0 sm:py-0"
                  >
                    Nhập kho
                  </Link>
                )}
              </div>
              <div className="mt-1 text-sm font-semibold text-emerald-700">
                Tổng: {formatShuttleStock(totalShuttleStockBalls)}
              </div>
            </div>
            {isTotalLowStock && (
              <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 sm:px-5">
                <div className="flex items-start gap-2">
                  <CircleAlert className="mt-0.5 h-5 w-5 flex-shrink-0 text-rose-600" />
                  <p className="text-sm font-medium text-rose-700">
                    Tổng cầu còn lại dưới {LOW_STOCK_TUBES} ống — cần nhập thêm!
                  </p>
                </div>
              </div>
            )}
            <div className="max-h-[min(40vh,320px)] divide-y divide-slate-100 overflow-y-auto lg:max-h-[min(35vh,280px)]">
              {loadingShuttles ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
                  Đang tải...
                </div>
              ) : shuttleTypes.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
                  Chưa có loại cầu
                </div>
              ) : shuttleTypesWithStock.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
                  Không có loại cầu nào còn tồn kho
                </div>
              ) : (
                shuttleTypesWithStock.map((st) => {
                  const q = Number(st.stock_quantity) || 0;
                  return (
                    <div key={st.id} className="px-4 py-3 sm:px-5">
                      <div className="text-sm font-semibold text-slate-900">
                        {st.name}
                      </div>
                      <div className="mt-0.5 text-sm text-slate-600">
                        {formatShuttleStock(q)}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
            <div className="border-b border-slate-100 px-4 py-4 sm:px-5">
              <h2 className="text-base font-semibold text-slate-900">
                DS chưa thanh toán ({unpaidPlayers.length})
              </h2>
              <div className="mt-1 text-sm font-semibold font-tabular text-rose-600">
                Tổng:{" "}
                {formatCurrencyRounded(
                  unpaidPlayers.reduce((sum, p) => sum + p.totalAmount, 0),
                )}
              </div>
            </div>
            <div className="max-h-[calc(100vh-300px)] divide-y divide-slate-100 overflow-y-auto">
              {loading ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
                  Đang tải...
                </div>
              ) : unpaidPlayers.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-slate-500 sm:px-5">
                  Không có người chơi nào chưa thanh toán
                </div>
              ) : (
                unpaidPlayers.map((player) => {
                  const isMarking = markingPayment.has(player.userId);
                  const isOverdue = isPlayerOverdue(player);
                  return (
                    <div
                      key={player.userId}
                      className={`relative px-4 py-3 sm:px-5 ${
                        isOverdue ? "bg-rose-50" : ""
                      }`}
                    >
                      <div className="mb-2">
                        <div className="break-words text-sm font-semibold text-slate-900">
                          {player.name}:{" "}
                          <span className="font-tabular text-rose-600">
                            {formatCurrencyRounded(player.totalAmount)}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm">
                        <div className="mb-1 font-medium text-slate-700">
                          DS ngày thiếu:
                        </div>
                        <div className="space-y-1 pl-2">
                          {player.unpaidDates.map((dateItem, idx) => (
                            <div
                              key={idx}
                              className="font-tabular text-slate-600"
                            >
                              {formatDateForUnpaid(dateItem.date)} :{" "}
                              {formatCurrencyRounded(dateItem.amount)}
                            </div>
                          ))}
                        </div>
                      </div>
                      {hasPermission("bills.mark_payment") && (
                        <div className="mt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setPayAllTarget(player)}
                            disabled={isMarking}
                            aria-label={`Đã trả hết: ${player.name}`}
                            className="btn btn-secondary btn-sm"
                          >
                            <Check className="h-4 w-4" />
                            Đã trả hết
                          </button>
                        </div>
                      )}
                      {isMarking && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/75">
                          <div className="text-sm text-slate-600">
                            Đang xử lý...
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        title="Xác nhận xóa bill"
        message="Bạn có chắc chắn muốn xóa bill này? Hành động này không thể hoàn tác."
      />

      <ConfirmDialog
        isOpen={Boolean(payAllTarget)}
        onClose={() => setPayAllTarget(null)}
        onConfirm={confirmPayAll}
        busy={payAllBusy}
        title="Đánh dấu đã trả hết?"
        message={
          payAllTarget &&
          `${payAllTarget.name}: ${payAllTarget.unpaidDates.length} ngày thiếu, tổng ${formatCurrencyRounded(payAllTarget.totalAmount)}. Mọi bill còn nợ của người này sẽ chuyển sang Đã TT.`
        }
        confirmLabel="Đã trả hết"
        confirmVariant="primary"
      />

      <BillFilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        dateFrom={filters.date_from}
        dateTo={filters.date_to}
        onChange={(range) => setFilters({ ...filters, ...range })}
        resultCount={totalEntries}
        loading={loading}
      />

      <UnpaidPlayersSheet
        isOpen={unpaidSheetOpen}
        onClose={() => setUnpaidSheetOpen(false)}
        players={unpaidPlayers}
        total={unpaidTotal}
        loading={loading}
        canView={hasPermission("bills.view")}
        canMark={hasPermission("bills.mark_payment")}
        markingIds={markingPayment}
        onPayAll={setPayAllTarget}
      />

      <ShuttleStockSheet
        isOpen={stockSheetOpen}
        onClose={() => setStockSheetOpen(false)}
        shuttleTypes={shuttleTypes}
        stockedTypes={shuttleTypesWithStock}
        totalBalls={totalShuttleStockBalls}
        lowStock={isTotalLowStock}
        loading={loadingShuttles}
        canImport={hasPermission("shuttles.view")}
      />

      {statsModalOpen && (
        <StatsSheet
          onClose={() => setStatsModalOpen(false)}
          bills={stats.bills}
          status={stats.status}
          onRetry={loadStatsBills}
        />
      )}

      {/* Sticky FAB — mobile only, primary action: create bill */}
      {hasPermission("bills.create") && (
        <Link to="/bills/create" aria-label="Tạo bill mới" className="fab fab-enter">
          <Plus strokeWidth={2.25} />
        </Link>
      )}
    </div>
  );
}
