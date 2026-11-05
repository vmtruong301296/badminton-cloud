import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { partyBillsApi } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { formatCurrencyRounded } from "../../utils/formatters";
import {
  collectPartyUnpaid,
  filterPartyBills,
  isPartyBillOverdue as isBillOverdue,
  isUnpaidParticipantOverdue as isParticipantOverdue,
  partyBillStatus as getBillStatus,
  partyFilterCount,
  partyUnpaidCount as getUnpaidCount,
} from "../../utils/partyBillList";
import { dateRangeLabel } from "../../utils/billList";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PartyBillList, {
  PartyBillListSkeleton,
} from "../../components/party/PartyBillList";
import PartyFilterSheet from "../../components/party/PartyFilterSheet";
import PartyUnpaidSheet from "../../components/party/PartyUnpaidSheet";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import useToast from "../../components/ui/useToast";
import {
  ChevronLeft,
  Plus,
  SlidersHorizontal,
  Trash2,
  UtensilsCrossed,
  X,
} from "../../components/ui/icons";

// Điện thoại: "Xem thêm" mỗi lần 10 bill thay cho phân trang (quyết định 14).
const MOBILE_PAGE_SIZE = 10;
const STATUS_CHIPS = [
  { value: "partial", label: "1 phần" },
  { value: "unpaid", label: "Chưa TT" },
  { value: "paid", label: "Đã TT" },
];

const formatDateForUnpaid = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

export default function PartyBills() {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [bills, setBills] = useState([]);
  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    status: ["partial", "unpaid"],
    limit: 10,
    name: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleCount, setVisibleCount] = useState(MOBILE_PAGE_SIZE);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [unpaidSheetOpen, setUnpaidSheetOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    id: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [markingPayment, setMarkingPayment] = useState(new Set());
  // "Đã trả hết": người đang chờ xác nhận (quyết định 7) và lúc đang gọi API.
  const [payAllTarget, setPayAllTarget] = useState(null);
  const [payAllBusy, setPayAllBusy] = useState(false);

  useEffect(() => {
    loadBills();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const loadBills = async () => {
    try {
      setLoading(true);
      setLoadError(false);
      const res = await partyBillsApi.getAll();
      setBills(res.data || []);
    } catch (error) {
      console.error("Error loading party bills", error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // Bộ lọc trên điện thoại: đổi điều kiện thì danh sách về 10 bill đầu.
  const changeFilters = (patch) => {
    setFilters((prev) => ({ ...prev, ...patch }));
    setVisibleCount(MOBILE_PAGE_SIZE);
  };
  const toggleStatus = (value) =>
    changeFilters({
      status: filters.status.includes(value)
        ? filters.status.filter((s) => s !== value)
        : [...filters.status, value],
    });
  const clearFilters = () =>
    changeFilters({ date_from: "", date_to: "", status: [], name: "" });

  const getStatusMeta = (status) => {
    if (status === "paid")
      return {
        text: "Đã thanh toán",
        cls: "badge-emerald",
        dot: "bg-emerald-500",
      };
    if (status === "partial")
      return {
        text: "Thanh toán 1 phần",
        cls: "badge-amber",
        dot: "bg-amber-500",
      };
    return {
      text: "Chưa thanh toán",
      cls: "badge-slate",
      dot: "bg-slate-400",
    };
  };

  const unpaidParticipants = useMemo(() => collectPartyUnpaid(bills), [bills]);
  const unpaidTotal = unpaidParticipants.reduce(
    (sum, p) => sum + p.totalAmount,
    0,
  );

  const filteredBills = useMemo(
    () => filterPartyBills(bills, filters),
    [bills, filters],
  );

  const totalBillsCount = filteredBills.length;
  const totalPages = Math.max(1, Math.ceil(totalBillsCount / filters.limit));
  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * filters.limit;
    return filteredBills.slice(start, start + filters.limit);
  }, [filteredBills, currentPage, filters.limit]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const handleDelete = async (id) => {
    setDeleting(true);
    try {
      await partyBillsApi.delete(id);
      setBills((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Delete party bill error", error);
      toast.error("Không thể xóa tiệc");
    } finally {
      setDeleting(false);
    }
  };

  const handleMarkParticipantPayment = async (person) => {
    const userId = person.userId;
    try {
      setMarkingPayment((prev) => new Set(prev).add(userId));
      const unpaidBills = bills.filter((bill) => {
        const p = bill.participants?.find((x) => x.user_id === userId);
        return p && !p.is_paid;
      });
      await Promise.all(
        unpaidBills.map(async (bill) => {
          const p = bill.participants?.find((x) => x.user_id === userId);
          if (p) {
            await partyBillsApi.markPayment(bill.id, p.id, { is_paid: true });
          }
        }),
      );

      setBills((prev) =>
        prev.map((bill) => {
          const idx = bill.participants?.findIndex((p) => p.user_id === userId);
          if (idx !== undefined && idx !== -1) {
            const next = { ...bill };
            next.participants = [...(bill.participants || [])];
            next.participants[idx] = {
              ...next.participants[idx],
              is_paid: true,
            };
            return next;
          }
          return bill;
        }),
      );
      toast.success(`Đã đánh dấu ${person.name} trả hết`);
    } catch (error) {
      console.error("Mark participant payment error", error);
      toast.error("Có lỗi khi đánh dấu thanh toán");
    } finally {
      setMarkingPayment((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const confirmPayAll = async () => {
    setPayAllBusy(true);
    await handleMarkParticipantPayment(payAllTarget);
    setPayAllBusy(false);
    setPayAllTarget(null);
  };

  // Ẩn nút theo quyền (quyết định 10); "trả hết" dùng party_bills.update (không có quyền đánh dấu riêng).
  const canCreate = hasPermission("party_bills.create");
  const canUpdate = hasPermission("party_bills.update");
  const canDelete = hasPermission("party_bills.delete");
  const filterCount = partyFilterCount(filters);
  const hasDateFilter = Boolean(filters.date_from || filters.date_to);
  const isFiltered = filteredBills.length < bills.length || filterCount > 0;
  const mobileBills = filteredBills.slice(0, visibleCount);

  const emptyState =
    bills.length > 0 && isFiltered ? (
      <EmptyState
        icon={UtensilsCrossed}
        title="Không có bill nào khớp bộ lọc"
        action={
          <button type="button" onClick={clearFilters} className="btn btn-secondary">
            Xóa lọc
          </button>
        }
      />
    ) : (
      <EmptyState
        icon={UtensilsCrossed}
        title="Chưa có bill tiệc nào"
        description="Thử xóa bộ lọc hoặc tạo bill tiệc mới để bắt đầu."
        action={
          canCreate && (
            <Link to="/party-bills/create" className="btn btn-primary">
              <Plus className="h-4 w-4" />
              Tạo bill đầu tiên
            </Link>
          )
        }
      />
    );

  return (
    <div className="px-4 sm:px-0">
      <PageHeader
        hideOnPhone
        title="Bill tiệc"
        description={
          loading ? (
            <span className="skeleton hidden h-3.5 w-24 align-middle sm:inline-block" />
          ) : (
            <span className="hidden sm:inline">
              <span className="font-tabular font-semibold text-slate-700">
                {totalBillsCount}
              </span>{" "}
              bill hiển thị
              {filters.date_from || filters.date_to ? " theo bộ lọc" : ""}
            </span>
          )
        }
        actions={
          canCreate && (
            <Link
              to="/party-bills/create"
              className="btn btn-primary hidden sm:inline-flex"
            >
              <Plus className="h-4 w-4" />
              Tạo Bill tiệc
            </Link>
          )
        }
      />

      {/* Điện thoại: thanh trên đã có tiêu đề, khối mô tả / nút của PageHeader không dựng (hideOnPhone) */}
      <div>
        {/* Người còn nợ (M11) → sheet; từ lg là khối ở cột phải. Ẩn khi không còn ai nợ. */}
        {loading ? (
          <div className="stat-tile mb-3 w-full lg:hidden" aria-hidden="true">
            <span className="skeleton h-3.5 w-28" />
            <span className="skeleton mt-1.5 h-6 w-32" />
          </div>
        ) : (
          !loadError &&
          unpaidParticipants.length > 0 && (
            <button
              type="button"
              onClick={() => setUnpaidSheetOpen(true)}
              aria-haspopup="dialog"
              aria-label="Xem người chưa thanh toán"
              className="stat-tile mb-3 w-full flex-row items-center justify-between gap-3 lg:hidden"
            >
              <span className="min-w-0">
                <span className="stat-tile-label block font-medium text-slate-700">
                  Chưa thanh toán
                </span>
                <span className="stat-tile-sub block">
                  {unpaidParticipants.length} người
                </span>
              </span>
              <span className="stat-tile-value mt-0 text-lg text-rose-700 min-[400px]:text-xl">
                {formatCurrencyRounded(unpaidTotal)}
              </span>
            </button>
          )
        )}

        {/* Lọc trên điện thoại (M4): "Lọc" ghim trái mở sheet, chip trạng thái cuộn ngang */}
        <div className="chip-bar mb-3 md:hidden">
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            aria-haspopup="dialog"
            aria-label={filterCount > 0 ? `Lọc (${filterCount})` : undefined}
            className="chip"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Lọc
            {filterCount > 0 && (
              <span className="chip-count">{filterCount}</span>
            )}
          </button>
          <div className="chip-row">
            {hasDateFilter && (
              <span className="chip chip-applied">
                {dateRangeLabel(filters.date_from, filters.date_to)}
                <button
                  type="button"
                  onClick={() => changeFilters({ date_from: "", date_to: "" })}
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
      <section aria-label="Lọc danh sách bill tiệc" className="card mb-3 hidden !p-0 sm:mb-6 md:block">
        <div className="flex flex-col gap-3 p-2 sm:p-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-5 lg:gap-y-3">
          {/* Dates */}
          <div id="party-filter-dates" className="grid min-w-0 grid-cols-2 gap-2 sm:gap-3 lg:flex">
            <div className="min-w-0">
              <label htmlFor="pb-date-from" className="field-label">
                Từ ngày
              </label>
              <input
                id="pb-date-from"
                type="date"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters({ ...filters, date_from: e.target.value })
                }
                className="field-input min-w-0 lg:w-40"
              />
            </div>
            <div className="min-w-0">
              <label htmlFor="pb-date-to" className="field-label">
                Đến ngày
              </label>
              <input
                id="pb-date-to"
                type="date"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters({ ...filters, date_to: e.target.value })
                }
                className="field-input min-w-0 lg:w-40"
              />
            </div>
          </div>

          {/* Tên tiệc */}
          <div id="party-filter-name" className="lg:min-w-[200px] lg:flex-1">
            <label htmlFor="pb-name" className="field-label">
              Tên tiệc
            </label>
            <input
              id="pb-name"
              type="text"
              value={filters.name}
              onChange={(e) => setFilters({ ...filters, name: e.target.value })}
              placeholder="Tìm theo tên/nội dung tiệc..."
              className="field-input"
            />
          </div>

          {/* Status chips */}
          <div className="order-first sm:order-none">
            <span id="pb-status-label" className="sr-only sm:not-sr-only sm:field-label">
              Trạng thái
            </span>
            <div
              role="group"
              aria-labelledby="pb-status-label"
              className="grid grid-cols-[repeat(3,minmax(0,1fr))_auto] gap-1 sm:flex sm:flex-wrap sm:gap-2"
            >
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
                const isActive =
                  Array.isArray(filters.status) &&
                  filters.status.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    aria-pressed={isActive}
                    aria-label={opt.label}
                    onClick={() => {
                      const next = isActive
                        ? filters.status.filter((s) => s !== opt.value)
                        : [...filters.status, opt.value];
                      setFilters({ ...filters, status: next });
                    }}
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
          <div id="party-filter-options" className="grid grid-cols-2 gap-2 sm:gap-3 lg:ml-auto lg:flex lg:items-end">
            <div>
              <label htmlFor="pb-limit" className="field-label">
                Số bill / trang
              </label>
              <select
                id="pb-limit"
                value={filters.limit}
                onChange={(e) =>
                  setFilters({ ...filters, limit: parseInt(e.target.value) })
                }
                className="field-input lg:w-24"
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    date_from: "",
                    date_to: "",
                    status: [],
                    limit: 10,
                    name: "",
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

      {/* Main content: bills list (3/4) + unpaid sidebar (1/4) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Bills column */}
        <div className="lg:col-span-3">
          {loading ? (
            <>
            <PartyBillListSkeleton className="md:hidden" />
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
              title="Không tải được danh sách tiệc"
              onRetry={loadBills}
            />
          ) : filteredBills.length === 0 ? (
            emptyState
          ) : (
            <>
            <div className="md:hidden">
              <PartyBillList
                bills={mobileBills}
                totalCount={filteredBills.length}
                pageSize={MOBILE_PAGE_SIZE}
                onShowMore={() =>
                  setVisibleCount((count) => count + MOBILE_PAGE_SIZE)
                }
              />
            </div>
            <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card md:block">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                        Ngày
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                        Tên/Nội dung
                      </th>
                      <th className="px-5 py-3 text-right text-xs font-medium text-slate-500">
                        Tổng tiền
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                        Trạng thái
                      </th>
                      <th className="px-5 py-3 text-center text-xs font-medium text-slate-500">
                        Chưa TT
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-500">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {paginatedBills.map((bill) => {
                      const status = getBillStatus(bill);
                      const meta = getStatusMeta(status);
                      const totalFood = (bill.participants || []).reduce(
                        (sum, p) => sum + (Number(p.food_amount) || 0),
                        0,
                      );
                      const totalWithFood =
                        (bill.total_amount || 0) + totalFood;
                      const unpaidCount = getUnpaidCount(bill);
                      const overdue = isBillOverdue(bill);
                      return (
                        <tr
                          key={bill.id}
                          className={`transition ${
                            overdue
                              ? "bg-rose-50/60 hover:bg-rose-100/60"
                              : status === "paid"
                                ? "bg-emerald-50/30 hover:bg-emerald-50/50"
                                : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="px-5 py-4 text-sm whitespace-nowrap text-slate-700">
                            {bill.date ? bill.date.slice(0, 10) : "-"}
                          </td>
                          <td className="px-5 py-4">
                            <div className="font-medium text-slate-900">
                              {bill.name || "-"}
                            </div>
                            {bill.note && (
                              <div className="mt-0.5 text-xs text-slate-500 line-clamp-1">
                                {bill.note}
                              </div>
                            )}
                          </td>
                          <td className="font-tabular px-5 py-4 text-right text-sm font-semibold text-slate-900">
                            {formatCurrencyRounded(totalWithFood)}
                          </td>
                          <td className="px-5 py-4">
                            <span className={`badge gap-1.5 whitespace-nowrap ${meta.cls}`}>
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                              />
                              {meta.text}
                            </span>
                          </td>
                          <td className="font-tabular px-5 py-4 text-center text-sm text-slate-700">
                            {unpaidCount}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <Link
                                to={`/party-bills/${bill.id}`}
                                className="whitespace-nowrap text-sm font-medium text-emerald-700 hover:text-emerald-900"
                              >
                                Chi tiết
                              </Link>
                              {status !== "paid" && canUpdate && (
                                <Link
                                  to={`/party-bills/${bill.id}/edit`}
                                  className="whitespace-nowrap text-sm font-medium text-slate-600 hover:text-slate-900"
                                >
                                  Sửa
                                </Link>
                              )}
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteConfirm({
                                      isOpen: true,
                                      id: bill.id,
                                    })
                                  }
                                  className="whitespace-nowrap text-sm font-medium text-rose-600 hover:text-rose-800"
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
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-4 sm:px-6">
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
                    <div className="flex items-center gap-1.5">
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
                                className={`btn font-tabular min-w-11 !px-2 sm:min-w-10 ${
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
            </>
          )}
        </div>

        {/* Unpaid sidebar */}
        <div className="hidden lg:col-span-1 lg:block">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card lg:sticky lg:top-20">
            <div className="border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5 sm:py-4">
              <p className="text-xs font-medium text-slate-500">
                Chưa thanh toán
              </p>
              <h3 className="font-display mt-0.5 text-lg font-semibold text-slate-900">
                {unpaidParticipants.length} người
              </h3>
              <div className="mt-1 font-tabular text-sm font-semibold text-rose-600">
                Tổng:{" "}
                {formatCurrencyRounded(
                  unpaidParticipants.reduce((sum, p) => sum + p.totalAmount, 0),
                )}
              </div>
            </div>
            <div className="divide-y divide-slate-100 max-h-[calc(100vh-300px)] overflow-y-auto">
              {loading ? (
                <div className="px-4 sm:px-5 py-8 text-center text-sm text-slate-500">
                  Đang tải...
                </div>
              ) : unpaidParticipants.length === 0 ? (
                <div className="px-4 sm:px-5 py-8 text-center text-sm text-slate-500">
                  Tất cả đã thanh toán
                </div>
              ) : (
                unpaidParticipants.map((p) => {
                  const isMarking = markingPayment.has(p.userId);
                  const overdue = isParticipantOverdue(p);
                  return (
                    <div
                      key={p.userId}
                      className={`relative px-4 sm:px-5 py-3 ${
                        overdue ? "bg-rose-50/70" : "hover:bg-slate-50/60"
                      }`}
                    >
                      <div className="mb-2 pr-12">
                        <div className="text-sm font-semibold text-slate-900">
                          {p.name}:{" "}
                          <span className="font-tabular text-rose-600">
                            {formatCurrencyRounded(p.totalAmount)}
                          </span>
                        </div>
                      </div>
                      <div className="pr-12 text-xs text-slate-600">
                        <div className="mb-1 font-medium text-slate-700">
                          DS ngày thiếu:
                        </div>
                        <div className="space-y-0.5 pl-2">
                          {p.unpaidDates.map((d, idx) => (
                            <div key={idx}>
                              {formatDateForUnpaid(d.date)} :{" "}
                              <span className="font-tabular">
                                {formatCurrencyRounded(d.amount)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      {canUpdate && (
                      <label className="absolute right-1 top-1 flex h-11 w-11 cursor-pointer items-center justify-center sm:right-2">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => setPayAllTarget(p)}
                          disabled={isMarking}
                          aria-label={`Đánh dấu ${p.name} đã thanh toán tất cả bills`}
                          className="h-6 w-6 cursor-pointer accent-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Đánh dấu thanh toán tất cả bills"
                        />
                      </label>
                      )}
                      {isMarking && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/75 text-xs text-slate-600">
                          Đang xử lý...
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
        busy={deleting}
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={async () => {
          await handleDelete(deleteConfirm.id);
          setDeleteConfirm({ isOpen: false, id: null });
        }}
        title="Xác nhận xóa"
        message="Bạn có chắc chắn muốn xóa bill tiệc này?"
      />

      <ConfirmDialog
        isOpen={Boolean(payAllTarget)}
        busy={payAllBusy}
        onClose={() => setPayAllTarget(null)}
        onConfirm={confirmPayAll}
        title="Xác nhận thanh toán"
        message={
          payAllTarget &&
          `Đánh dấu ${payAllTarget.name} đã thanh toán ${payAllTarget.billCount} bill tiệc (${formatCurrencyRounded(payAllTarget.totalAmount)})?`
        }
        confirmLabel="Đã thanh toán"
        confirmVariant="primary"
      />

      <PartyFilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        dateFrom={filters.date_from}
        dateTo={filters.date_to}
        name={filters.name}
        onChange={changeFilters}
        resultCount={filteredBills.length}
      />

      <PartyUnpaidSheet
        isOpen={unpaidSheetOpen}
        onClose={() => setUnpaidSheetOpen(false)}
        people={unpaidParticipants}
        total={unpaidTotal}
        canMark={canUpdate}
        markingIds={markingPayment}
        onPayAll={setPayAllTarget}
      />

      {/* Mobile FAB */}
      {canCreate && (
        <Link
          to="/party-bills/create"
          aria-label="Tạo Bill tiệc mới"
          className="fab fab-enter"
        >
          <Plus />
        </Link>
      )}
    </div>
  );
}
