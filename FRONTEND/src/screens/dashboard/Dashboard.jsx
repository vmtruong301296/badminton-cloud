import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { billsApi, shuttlesApi } from "../../services/api";
import {
  formatCurrencyRounded,
  formatDate,
  formatNumber,
  roundToNearestThousand,
} from "../../utils/formatters";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import Modal from "../../components/ui/Modal";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import {
  ChartLine,
  ChevronLeft,
  CircleAlert,
  Plus,
  Receipt,
  Trash2,
} from "../../components/ui/icons";
import { useAuth } from "../../contexts/AuthContext";

const BALLS_PER_TUBE = 12;
// Ngưỡng cảnh báo sắp hết cầu: TỔNG tồn dưới 10 ống
const LOW_STOCK_TUBES = 10;
const LOW_STOCK_BALLS = LOW_STOCK_TUBES * BALLS_PER_TUBE;

/** Hiển thị tồn kho: quả + gợi ý ống (12 quả/ống). */
function formatShuttleStockDisplay(totalBalls) {
  const n = Math.floor(Number(totalBalls) || 0);
  if (n < 0) {
    return `${formatNumber(n)} quả`;
  }
  const tubes = Math.floor(n / BALLS_PER_TUBE);
  const rem = n % BALLS_PER_TUBE;
  if (n === 0) return "0 quả";
  if (tubes === 0) return `${formatNumber(n)} quả`;
  if (rem === 0) return `${tubes} ống (${formatNumber(n)} quả)`;
  return `${tubes} ống + ${rem} quả (${formatNumber(n)} quả)`;
}

/** Tháng hiện tại ở định dạng YYYY-MM cho <input type="month">. */
function currentMonthValue() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function Dashboard() {
  const { hasPermission } = useAuth();
  const [bills, setBills] = useState([]);
  const [allBills, setAllBills] = useState([]); // Store all bills for unpaid players calculation
  const [loading, setLoading] = useState(true);
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
  const [statsMonth, setStatsMonth] = useState(currentMonthValue);
  const [statsYear, setStatsYear] = useState(() => new Date().getFullYear());
  const [statsMode, setStatsMode] = useState("month"); // 'month' | 'year'
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [shuttleTypes, setShuttleTypes] = useState([]);
  const [loadingShuttles, setLoadingShuttles] = useState(true);

  useEffect(() => {
    loadBills();
    setCurrentPage(1); // Reset to page 1 when filters change
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
    try {
      setLoading(true);
      const params = {};
      if (filters.date_from) params.date_from = filters.date_from;
      if (filters.date_to) params.date_to = filters.date_to;
      if (filters.player_id) params.player_id = filters.player_id;

      const response = await billsApi.getAll(params);
      let filteredBills = response.data;

      // Store all bills for unpaid players calculation (without status filter)
      setAllBills(response.data);

      // Filter by status on frontend (multiple statuses can be selected)
      if (filters.status && filters.status.length > 0) {
        filteredBills = filteredBills.filter((bill) => {
          const allPaid = bill.bill_players?.every((p) => p.is_paid) || false;
          const somePaid = bill.bill_players?.some((p) => p.is_paid) || false;

          // Check if bill matches any of the selected statuses
          return filters.status.some((status) => {
            if (status === "paid")
              return allPaid && bill.bill_players?.length > 0;
            if (status === "partial") return somePaid && !allPaid;
            if (status === "unpaid") return !somePaid;
            return false;
          });
        });
      }

      setBills(filteredBills);
    } catch (error) {
      console.error("Error loading bills:", error);
    } finally {
      setLoading(false);
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

  // Check if bill is overdue (quá 7 ngày) and has unpaid players
  const isOverdueWarning = (bill) => {
    if (!bill.date) return false;

    const billDate = new Date(bill.date);
    billDate.setHours(0, 0, 0, 0); // Reset time to start of day

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day

    // Calculate difference in days
    const diffTime = today - billDate;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    // Check if bill is 7 days or more old (quá 7 ngày)
    const isOverdue = diffDays >= 7;

    // Check if there are unpaid players
    const unpaidCount =
      bill.bill_players?.filter((p) => !p.is_paid).length || 0;
    const hasUnpaidPlayers = unpaidCount > 0;

    return isOverdue && hasUnpaidPlayers;
  };

  // Check if player has overdue bills (quá 7 ngày)
  const isPlayerOverdue = (player) => {
    if (!player.unpaidDates || player.unpaidDates.length === 0) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day

    // Check if any unpaid date is 7 days or more old
    return player.unpaidDates.some((dateItem) => {
      if (!dateItem.date) return false;

      const billDate = new Date(dateItem.date);
      billDate.setHours(0, 0, 0, 0); // Reset time to start of day

      // Calculate difference in days
      const diffTime = today - billDate;
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Check if bill is 7 days or more old (quá 7 ngày)
      return diffDays >= 7;
    });
  };

  const handleDeleteClick = (billId) => {
    setDeleteConfirm({ isOpen: true, billId });
  };

  const handleDeleteConfirm = async () => {
    try {
      await billsApi.delete(deleteConfirm.billId);
      setDeleteConfirm({ isOpen: false, billId: null });
      loadBills(); // Reload bills after deletion
    } catch (error) {
      console.error("Error deleting bill:", error);
      alert("Có lỗi xảy ra khi xóa bill");
    }
  };

  const handleDeleteCancel = () => {
    setDeleteConfirm({ isOpen: false, billId: null });
  };

  // Mark payment for all unpaid bills of a player
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
      alert("Có lỗi xảy ra khi đánh dấu thanh toán");
    } finally {
      setMarkingPayment((prev) => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
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
  const unpaidPlayers = useMemo(() => {
    const playerMap = new Map();

    // Process all bills to collect unpaid players
    allBills.forEach((bill) => {
      if (!bill.bill_players) return;

      bill.bill_players.forEach((player) => {
        if (player.is_paid) return; // Skip paid players

        const userId = player.user_id;
        const userName = player.user?.name || "Unknown";

        if (!playerMap.has(userId)) {
          playerMap.set(userId, {
            userId,
            name: userName,
            totalAmount: 0,
            unpaidDates: [],
          });
        }

        const playerData = playerMap.get(userId);
        // Total amount includes both current bill amount and debt amount (đã làm tròn)
        const playerTotal = roundToNearestThousand(
          (player.total_amount || 0) + (player.debt_amount || 0),
        );
        playerData.totalAmount += playerTotal;

        // Add bill date if player hasn't paid (only current bill amount, debt được tách ở debt_details)
        if (bill.date && player.total_amount > 0) {
          playerData.unpaidDates.push({
            date: bill.date,
            // Làm tròn giống như tổng để tránh lệch giữa "Tổng tiền" và "DS ngày thiếu"
            amount: roundToNearestThousand(player.total_amount || 0),
            billId: bill.id,
          });
        }

        // Add debt details dates
        if (player.debt_details && Array.isArray(player.debt_details)) {
          player.debt_details.forEach((debt) => {
            if (debt.date) {
              let debtAmount = 0;
              if (debt.parent_amount !== null) {
                debtAmount += debt.parent_amount;
              }
              if (debt.sub_bills && Array.isArray(debt.sub_bills)) {
                debt.sub_bills.forEach((subBill) => {
                  debtAmount += subBill.amount || 0;
                });
              }

              if (debtAmount > 0) {
                playerData.unpaidDates.push({
                  date: debt.date,
                  // Làm tròn cho từng mục nợ theo đúng cách hiển thị
                  amount: roundToNearestThousand(debtAmount),
                  billId: bill.id,
                });
              }
            }
          });
        }
      });
    });

    // Convert map to array and sort dates (newest first)
    return Array.from(playerMap.values())
      .map((player) => {
        // Sort dates: newest first (descending)
        const sortedDates = [...player.unpaidDates].sort((a, b) => {
          return new Date(b.date) - new Date(a.date);
        });

        // Group by date and sum amounts for same date
        const dateMap = new Map();
        sortedDates.forEach((item) => {
          const dateKey = item.date;
          if (!dateMap.has(dateKey)) {
            dateMap.set(dateKey, { date: dateKey, amount: 0 });
          }
          dateMap.get(dateKey).amount += item.amount;
        });

        return {
          ...player,
          unpaidDates: Array.from(dateMap.values()).sort((a, b) => {
            return new Date(b.date) - new Date(a.date);
          }),
        };
      })
      .filter((player) => player.totalAmount > 0)
      .sort((a, b) => {
        // Sort by latest unpaid date (descending - newest first)
        const aLatestDate =
          a.unpaidDates && a.unpaidDates.length > 0
            ? new Date(a.unpaidDates[0].date)
            : new Date(0);
        const bLatestDate =
          b.unpaidDates && b.unpaidDates.length > 0
            ? new Date(b.unpaidDates[0].date)
            : new Date(0);
        return bLatestDate - aLatestDate; // Descending order (newest first)
      });
  }, [allBills]);

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

  /** Mở thống kê: luôn bắt đầu ở tháng hiện tại, kể cả lần trước xem theo năm. */
  const openStatsModal = () => {
    setStatsMode("month");
    setStatsMonth(currentMonthValue());
    setStatsYear(new Date().getFullYear());
    setStatsModalOpen(true);
  };

  // Các năm có bill (kèm năm hiện tại), mới -> cũ. Dùng cho dropdown thống kê theo năm.
  const availableYears = useMemo(() => {
    const years = new Set([new Date().getFullYear()]);
    (allBills || []).forEach((bill) => {
      if (!bill.date) return;
      const billYear = new Date(bill.date).getFullYear();
      if (!Number.isNaN(billYear)) years.add(billYear);
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [allBills]);

  // Calculate statistics for the selected period (month or year)
  const periodStats = useMemo(() => {
    if (!allBills || allBills.length === 0) {
      return {
        shuttles: [],
        players: [],
      };
    }

    // Khoảng ngày của kỳ đang xem: cả tháng hoặc cả năm
    let startDate;
    let endDate;
    if (statsMode === "year") {
      startDate = new Date(statsYear, 0, 1);
      endDate = new Date(statsYear, 11, 31, 23, 59, 59);
    } else {
      const [year, month] = statsMonth.split("-").map(Number);
      startDate = new Date(year, month - 1, 1);
      endDate = new Date(year, month, 0, 23, 59, 59); // Last day of month
    }

    // Filter bills in selected period
    const billsInMonth = allBills.filter((bill) => {
      if (!bill.date) return false;
      const billDate = new Date(bill.date);
      return billDate >= startDate && billDate <= endDate;
    });

    // Calculate shuttle statistics
    const shuttleMap = new Map(); // { shuttleTypeId: { name, totalQuantity } }
    billsInMonth.forEach((bill) => {
      if (bill.bill_shuttles && Array.isArray(bill.bill_shuttles)) {
        bill.bill_shuttles.forEach((shuttle) => {
          const shuttleTypeId = shuttle.shuttle_type_id;
          const shuttleTypeName = shuttle.shuttle_type?.name || "Unknown";
          const quantity = shuttle.quantity || 0;

          if (!shuttleMap.has(shuttleTypeId)) {
            shuttleMap.set(shuttleTypeId, {
              name: shuttleTypeName,
              totalQuantity: 0,
            });
          }

          const current = shuttleMap.get(shuttleTypeId);
          current.totalQuantity += quantity;
        });
      }
    });

    // Convert shuttle map to array and sort by name
    const shuttles = Array.from(shuttleMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name),
    );

    // Calculate player statistics
    const playerMap = new Map(); // { userId: { name, totalAmount, billCount } }
    billsInMonth.forEach((bill) => {
      // Only count main bills (not sub-bills)
      if (bill.parent_bill_id) return;

      if (bill.bill_players && Array.isArray(bill.bill_players)) {
        bill.bill_players.forEach((player) => {
          const userId = player.user_id;
          const userName = player.user?.name || "Unknown";
          // Total amount includes both current bill amount and debt amount
          const playerTotal = roundToNearestThousand(
            (player.total_amount || 0) + (player.debt_amount || 0),
          );

          if (!playerMap.has(userId)) {
            playerMap.set(userId, {
              name: userName,
              totalAmount: 0,
              billCount: 0,
            });
          }

          const current = playerMap.get(userId);
          current.totalAmount += playerTotal;
          current.billCount += 1; // Count this bill for this player
        });
      }
    });

    // Convert player map to array and sort by total amount (descending)
    const players = Array.from(playerMap.values())
      .filter((p) => p.totalAmount > 0)
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // Calculate total shuttles for "ống cầu" calculation
    const totalShuttles = shuttles.reduce((sum, s) => sum + s.totalQuantity, 0);
    const totalOngCau = Math.floor(totalShuttles / 12); // 1 ống cầu = 12 quả
    const remainingShuttles = totalShuttles % 12;

    return {
      shuttles,
      players,
      totalShuttles,
      totalOngCau,
      remainingShuttles,
    };
  }, [allBills, statsMode, statsMonth, statsYear]);

  return (
    <div className="px-4 sm:px-0 pb-24 md:pb-0">
      <PageHeader
        title="Danh sách Bills"
        description={
          loading ? (
            <span className="inline-block h-3.5 w-24 skeleton align-middle" />
          ) : (
            <>
              <span className="font-tabular font-semibold text-slate-700">
                {bills.length}
              </span>{" "}
              {bills.length === 1 ? "bill" : "bills"} hiển thị
              {filters.date_from || filters.date_to ? " theo bộ lọc" : ""}
            </>
          )
        }
        actions={
          <>
            <button
              type="button"
              onClick={openStatsModal}
              className="btn btn-secondary"
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

      {/* Filters — toolbar gọn 1 hàng trên desktop */}
      <section className="card mb-6 !p-3 sm:!p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-5 lg:gap-y-3">
          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 lg:flex lg:gap-3">
            <div>
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
                className="field-input lg:w-40"
              />
            </div>
            <div>
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
                className="field-input lg:w-40"
              />
            </div>
          </div>

          {/* Status chips */}
          <div role="group" aria-labelledby="filter-status-label">
            <span id="filter-status-label" className="field-label">
              Trạng thái
            </span>
            <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:gap-2">
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
                    aria-pressed={isActive}
                    onClick={() => {
                      const next = isActive
                        ? filters.status.filter((s) => s !== opt.value)
                        : [...filters.status, opt.value];
                      setFilters({ ...filters, status: next });
                    }}
                    className={`inline-flex h-11 items-center justify-center gap-1.5 rounded-full border px-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 focus-visible:ring-offset-1 sm:h-10 sm:gap-2 sm:px-3.5 sm:text-sm ${
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
          <div className="grid grid-cols-2 gap-3 lg:ml-auto lg:flex lg:items-end lg:gap-3">
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
                onClick={() =>
                  setFilters({
                    date_from: "",
                    date_to: "",
                    player_id: "",
                    status: [],
                    limit: 10,
                  })
                }
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
            <div className="rounded-2xl border border-slate-200 bg-white p-2 shadow-card">
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
              <div className="md:hidden space-y-3 p-3">
                {[...Array(4)].map((_, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-slate-100 p-4"
                  >
                    <div className="skeleton h-3 w-20 mb-3" />
                    <div className="skeleton h-6 w-32 mb-2" />
                    <div className="skeleton h-4 w-24 mb-4" />
                    <div className="skeleton h-11 w-full" />
                  </div>
                ))}
              </div>
            </div>
          ) : billGroups.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Chưa có bill nào"
              description="Thử xóa bộ lọc hoặc tạo bill mới để bắt đầu."
              action={
                hasPermission("bills.create") && (
                  <Link to="/bills/create" className="btn btn-primary">
                    <Plus className="h-4 w-4" />
                    Tạo bill đầu tiên
                  </Link>
                )
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
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
                    const mainBillWarning = isOverdueWarning(mainBill);
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
                          const subBillWarning = isOverdueWarning(subBill);
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

              <div className="md:hidden space-y-3 p-3">
                {billGroups.map((group) => {
                  const mainBill = group.mainBill;
                  const subBills = group.subBills;
                  const mainBillWarning = isOverdueWarning(mainBill);
                  const mainBillAllPaid =
                    mainBill.bill_players?.every((p) => p.is_paid) &&
                    mainBill.bill_players?.length > 0;
                  const mainUnpaid =
                    mainBill.bill_players?.filter((p) => !p.is_paid).length ||
                    0;

                  return (
                    <article
                      key={mainBill.id}
                      className={`overflow-hidden rounded-2xl border transition ${
                        mainBillWarning
                          ? "border-rose-300 ring-1 ring-rose-100"
                          : mainBillAllPaid
                            ? "border-emerald-300 ring-1 ring-emerald-50"
                            : "border-slate-200"
                      }`}
                    >
                      {/* Main Bill Card */}
                      <div
                        className={`p-4 ${
                          mainBillWarning
                            ? "bg-rose-50/70"
                            : mainBillAllPaid
                              ? "bg-emerald-50/50"
                              : "bg-white"
                        }`}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="font-tabular text-sm font-medium text-slate-500">
                              {formatDate(mainBill.date)}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className="badge badge-slate">
                                Bill chính #{mainBill.id}
                              </span>
                              {mainBillWarning && (
                                <span className="badge badge-rose gap-1">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                                  Quá hạn
                                </span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`badge gap-1.5 ${getStatusColor(mainBill)}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${mainBillAllPaid ? "bg-emerald-500" : mainUnpaid > 0 && mainBill.bill_players?.some((p) => p.is_paid) ? "bg-amber-500" : "bg-slate-400"}`}
                            />
                            {getStatusText(mainBill)}
                          </span>
                        </div>

                        <div className="font-tabular text-2xl font-semibold leading-tight tracking-tight text-slate-900">
                          {formatCurrencyRounded(mainBill.total_amount)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {mainUnpaid > 0 ? (
                            <>
                              <span className="font-semibold text-slate-700">
                                {mainUnpaid}
                              </span>{" "}
                              người chưa thanh toán
                            </>
                          ) : (
                            <span className="font-medium text-emerald-700">
                              Tất cả đã thanh toán
                            </span>
                          )}
                        </div>

                        <div className="mt-4 flex gap-2 border-t border-slate-200/70 pt-3">
                          {hasPermission("bills.view") && (
                            <Link
                              to={`/bills/${mainBill.id}`}
                              className="btn btn-primary flex-1"
                            >
                              Chi tiết
                            </Link>
                          )}
                          {hasPermission("bills.delete") && (
                            <button
                              type="button"
                              onClick={() => handleDeleteClick(mainBill.id)}
                              aria-label={`Xóa bill #${mainBill.id}`}
                              className="btn btn-danger-soft btn-icon"
                            >
                              <Trash2 className="h-5 w-5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Sub Bills Cards */}
                      {subBills.map((subBill) => {
                        const subBillWarning = isOverdueWarning(subBill);
                        const subBillAllPaid =
                          subBill.bill_players?.every((p) => p.is_paid) &&
                          subBill.bill_players?.length > 0;
                        const subUnpaid =
                          subBill.bill_players?.filter((p) => !p.is_paid)
                            .length || 0;
                        return (
                          <div
                            key={subBill.id}
                            className={`relative border-t border-slate-200/70 p-4 pl-6 ${
                              subBillWarning
                                ? "bg-rose-50/70"
                                : subBillAllPaid
                                  ? "bg-emerald-50/40"
                                  : "bg-sky-50/60"
                            }`}
                          >
                            <span
                              className="absolute left-2 top-4 bottom-4 w-0.5 rounded-full bg-sky-300"
                              aria-hidden
                            />
                            <div className="mb-3 flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="badge badge-sky">
                                    Bill con
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    của #{mainBill.id}
                                  </span>
                                </div>
                              </div>
                              <span
                                className={`badge gap-1.5 ${getStatusColor(subBill)}`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${subBillAllPaid ? "bg-emerald-500" : subUnpaid > 0 && subBill.bill_players?.some((p) => p.is_paid) ? "bg-amber-500" : "bg-slate-400"}`}
                                />
                                {getStatusText(subBill)}
                              </span>
                            </div>
                            <div className="font-tabular text-xl font-semibold tracking-tight text-slate-900">
                              {formatCurrencyRounded(subBill.total_amount)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500">
                              {subUnpaid > 0 ? (
                                <>
                                  <span className="font-semibold text-slate-700">
                                    {subUnpaid}
                                  </span>{" "}
                                  người chưa thanh toán
                                </>
                              ) : (
                                <span className="font-medium text-emerald-700">
                                  Tất cả đã thanh toán
                                </span>
                              )}
                            </div>
                            <div className="mt-4 flex gap-2 border-t border-slate-200/70 pt-3">
                              {hasPermission("bills.view") && (
                                <Link
                                  to={`/bills/${subBill.id}`}
                                  className="btn btn-secondary flex-1"
                                >
                                  Chi tiết
                                </Link>
                              )}
                              {hasPermission("bills.delete") && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteClick(subBill.id)}
                                  aria-label={`Xóa bill con #${subBill.id}`}
                                  className="btn btn-danger-soft btn-icon"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </article>
                  );
                })}
              </div>

              {/* Legend/Chú thích */}
              <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
                <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
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
        </div>

        {/* Right column: Cầu khả dụng + DS chưa thanh toán */}
        <div className="lg:col-span-1 space-y-6">
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
                Tổng: {formatShuttleStockDisplay(totalShuttleStockBalls)}
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
                        {formatShuttleStockDisplay(q)}
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
                      <div className="mb-2 pr-12">
                        <div className="break-words text-sm font-semibold text-slate-900">
                          {player.name}:{" "}
                          <span className="font-tabular text-rose-600">
                            {formatCurrencyRounded(player.totalAmount)}
                          </span>
                        </div>
                      </div>
                      <div className="pr-12 text-sm">
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
                        <label className="absolute right-1 top-1 flex h-11 w-11 cursor-pointer items-center justify-center sm:right-2">
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() =>
                              handleMarkPlayerPayment(player.userId)
                            }
                            disabled={isMarking}
                            aria-label={`Đánh dấu thanh toán tất cả bills của ${player.name}`}
                            className="h-5 w-5 cursor-pointer accent-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </label>
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

      {/* Statistics Modal */}
      <Modal
        isOpen={statsModalOpen}
        onClose={() => setStatsModalOpen(false)}
        title="Thống kê"
        size="xl"
      >
        <div className="mb-5 flex flex-wrap items-center gap-3">
          {/* Chọn kỳ thống kê: theo tháng hoặc cả năm */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1">
            {[
              { value: "month", label: "Tháng" },
              { value: "year", label: "Năm" },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setStatsMode(option.value)}
                aria-pressed={statsMode === option.value}
                className={`h-9 rounded-lg px-4 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40 ${
                  statsMode === option.value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label
            htmlFor="stats-period"
            className="text-sm font-medium text-slate-700"
          >
            {statsMode === "year" ? "Chọn năm:" : "Chọn tháng:"}
          </label>
          {statsMode === "year" ? (
            <select
              id="stats-period"
              value={statsYear}
              onChange={(e) => setStatsYear(Number(e.target.value))}
              className="field-input !w-auto"
            >
              {availableYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="stats-period"
              type="month"
              value={statsMonth}
              onChange={(e) => setStatsMonth(e.target.value)}
              className="field-input !w-auto"
            />
          )}
        </div>

        <div className="space-y-4">
          {/* Shuttle Statistics */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Tổng số lượng cầu
            </h3>
            {periodStats.shuttles.length === 0 ? (
              <div className="text-sm text-slate-500">
                Không có dữ liệu cầu trong{" "}
                {statsMode === "year" ? "năm" : "tháng"} này
              </div>
            ) : (
              <div className="space-y-2">
                {periodStats.shuttles.map((shuttle, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between gap-3 border-b border-slate-200 py-2 last:border-0"
                  >
                    <span className="min-w-0 break-words text-sm font-medium text-slate-700">
                      {shuttle.name}
                    </span>
                    <span className="flex-shrink-0 font-tabular text-sm font-semibold text-slate-900">
                      {shuttle.totalQuantity} quả
                    </span>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t-2 border-slate-300 pt-2">
                  <span className="text-sm font-bold text-slate-900">
                    Tổng cộng:
                  </span>
                  <span className="font-tabular text-sm font-bold text-slate-900">
                    {periodStats.totalShuttles} quả
                  </span>
                </div>
                {/* Ống cầu */}
                <div className="mt-2 flex items-center justify-between rounded-lg bg-sky-50 px-3 py-2">
                  <span className="text-sm font-bold text-sky-900">
                    Tổng ống cầu:
                  </span>
                  <span className="text-sm font-bold text-sky-900">
                    {periodStats.totalOngCau} ống
                    {periodStats.remainingShuttles > 0 && (
                      <span className="ml-1 text-xs font-normal text-slate-600">
                        ({periodStats.remainingShuttles} quả lẻ)
                      </span>
                    )}
                  </span>
                </div>
                <div className="mt-1 text-xs italic text-slate-500">
                  * 1 ống cầu = 12 quả
                </div>
              </div>
            )}
          </div>

          {/* Player Statistics */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-base font-semibold text-slate-900">
              Tổng tiền theo người chơi ({periodStats.players.length})
            </h3>
            {periodStats.players.length === 0 ? (
              <div className="text-sm text-slate-500">
                Không có dữ liệu người chơi trong{" "}
                {statsMode === "year" ? "năm" : "tháng"} này
              </div>
            ) : (
              <div className="space-y-2">
                {periodStats.players.map((player, index) => (
                  <div
                    key={index}
                    className="border-b border-slate-200 py-2 last:border-0"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="min-w-0 break-words text-sm font-medium text-slate-700">
                        #{index + 1} {player.name}
                      </span>
                      <span className="flex-shrink-0 font-tabular text-sm font-semibold text-slate-900">
                        {formatCurrencyRounded(player.totalAmount)}
                      </span>
                    </div>
                    <div className="mt-1 flex justify-end">
                      <span className="text-xs text-slate-500">
                        Số bill: {player.billCount || 0}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex items-center justify-between border-t-2 border-slate-300 pt-2">
                  <span className="text-sm font-bold text-slate-900">
                    Tổng cộng:
                  </span>
                  <span className="font-tabular text-sm font-bold text-slate-900">
                    {formatCurrencyRounded(
                      periodStats.players.reduce(
                        (sum, p) => sum + p.totalAmount,
                        0,
                      ),
                    )}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* Sticky FAB — mobile only, primary action: create bill */}
      {hasPermission("bills.create") && (
        <Link
          to="/bills/create"
          aria-label="Tạo bill mới"
          className="fab-enter fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-5 z-30 sm:bottom-5 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-fab transition-all active:scale-95 hover:bg-emerald-800 md:hidden"
        >
          <Plus className="h-6 w-6" strokeWidth={2.25} />
        </Link>
      )}
    </div>
  );
}
