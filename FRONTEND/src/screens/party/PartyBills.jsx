import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { partyBillsApi } from "../../services/api";
import {
  formatCurrencyRounded,
  formatDate,
  roundToNearestThousand,
} from "../../utils/formatters";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import PageHeader from "../../components/ui/PageHeader";
import EmptyState from "../../components/ui/EmptyState";
import {
  ChevronDown,
  ChevronLeft,
  Pencil,
  Plus,
  Trash2,
  UtensilsCrossed,
} from "../../components/ui/icons";

function normalize(str) {
  return (str || "")
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

const formatDateForUnpaid = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

export default function PartyBills() {
  const [loading, setLoading] = useState(true);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [bills, setBills] = useState([]);
  const [filters, setFilters] = useState({
    date_from: "",
    date_to: "",
    status: ["partial", "unpaid"],
    limit: 10,
    name: "",
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState({
    isOpen: false,
    id: null,
  });
  const [markingPayment, setMarkingPayment] = useState(new Set());

  useEffect(() => {
    loadBills();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filters]);

  const loadBills = async () => {
    try {
      setLoading(true);
      const res = await partyBillsApi.getAll();
      setBills(res.data || []);
    } catch (error) {
      console.error("Error loading party bills", error);
      alert("Không tải được danh sách tiệc");
    } finally {
      setLoading(false);
    }
  };

  const getBillStatus = (bill) => {
    const participants = bill.participants || [];
    const total = participants.length;
    const paid = participants.filter((p) => p.is_paid).length;
    if (total === 0) return "unknown";
    if (paid === total) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  };

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

  const getUnpaidCount = (bill) =>
    (bill.participants || []).filter((p) => !p.is_paid).length;

  const isBillOverdue = (bill) => {
    if (!bill.date) return false;
    const billDate = new Date(bill.date);
    billDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - billDate) / (1000 * 60 * 60 * 24));
    const hasUnpaid = (bill.participants || []).some((p) => !p.is_paid);
    return diffDays >= 7 && hasUnpaid;
  };

  const isParticipantOverdue = (participant) => {
    if (!participant.unpaidDates || participant.unpaidDates.length === 0)
      return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return participant.unpaidDates.some((d) => {
      if (!d.date) return false;
      const date = new Date(d.date);
      date.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((today - date) / (1000 * 60 * 60 * 24));
      return diffDays >= 7;
    });
  };

  // Calculate unpaid participants list
  const unpaidParticipants = useMemo(() => {
    const map = new Map();

    bills.forEach((bill) => {
      if (!bill.participants) return;
      bill.participants.forEach((p) => {
        if (p.is_paid) return;
        const userId = p.user_id;
        if (!userId) return;
        const name = p.name || "Unknown";
        if (!map.has(userId)) {
          map.set(userId, {
            userId,
            name,
            totalAmount: 0,
            unpaidDates: [],
          });
        }
        const data = map.get(userId);
        const shareAmount = p.share_amount || 0;
        const foodAmount = p.food_amount || 0;
        const paidAmount = p.paid_amount || 0;
        const rounded = roundToNearestThousand(
          shareAmount + foodAmount - paidAmount,
        );
        data.totalAmount += rounded;
        if (bill.date && rounded > 0) {
          data.unpaidDates.push({
            date: bill.date,
            amount: rounded,
            billId: bill.id,
          });
        }
      });
    });

    return Array.from(map.values())
      .map((p) => {
        const dateMap = new Map();
        p.unpaidDates.forEach((d) => {
          if (!dateMap.has(d.date))
            dateMap.set(d.date, { date: d.date, amount: 0 });
          dateMap.get(d.date).amount += d.amount;
        });
        return {
          ...p,
          unpaidDates: Array.from(dateMap.values()).sort(
            (a, b) => new Date(b.date) - new Date(a.date),
          ),
        };
      })
      .filter((p) => p.totalAmount > 0)
      .sort((a, b) => {
        const aDate =
          a.unpaidDates.length > 0
            ? new Date(a.unpaidDates[0].date)
            : new Date(0);
        const bDate =
          b.unpaidDates.length > 0
            ? new Date(b.unpaidDates[0].date)
            : new Date(0);
        return bDate - aDate;
      });
  }, [bills]);

  const filteredBills = useMemo(() => {
    let data = [...bills];
    if (filters.date_from) {
      data = data.filter((b) => !b.date || b.date >= filters.date_from);
    }
    if (filters.date_to) {
      data = data.filter((b) => !b.date || b.date <= filters.date_to);
    }
    if (
      filters.status &&
      Array.isArray(filters.status) &&
      filters.status.length > 0
    ) {
      data = data.filter((b) => filters.status.includes(getBillStatus(b)));
    }
    if (filters.name && filters.name.trim() !== "") {
      const q = normalize(filters.name.trim());
      data = data.filter((b) => normalize(b.name || "").includes(q));
    }
    data.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    return data;
  }, [bills, filters]);

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
    try {
      await partyBillsApi.delete(id);
      setBills((prev) => prev.filter((b) => b.id !== id));
    } catch (error) {
      console.error("Delete party bill error", error);
      alert("Không thể xóa tiệc");
    }
  };

  const handleMarkParticipantPayment = async (userId) => {
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
    } catch (error) {
      console.error("Mark participant payment error", error);
      alert("Có lỗi khi đánh dấu thanh toán");
    } finally {
      setMarkingPayment((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  return (
    <div className="px-3 pb-16 sm:px-0 md:pb-0">
      <PageHeader
        title="Danh sách Bills tiệc"
        description={
          loading ? (
            <span className="skeleton inline-block h-3.5 w-24 align-middle" />
          ) : (
            <>
              <span className="font-tabular font-semibold text-slate-700">
                {totalBillsCount}
              </span>{" "}
              bill hiển thị
              {filters.date_from || filters.date_to ? " theo bộ lọc" : ""}
            </>
          )
        }
        actions={
          <Link
            to="/party-bills/create"
            className="btn btn-primary hidden sm:inline-flex"
          >
            <Plus className="h-4 w-4" />
            Tạo Bill tiệc
          </Link>
        }
      />

      {/* Filters — toolbar gọn 1 hàng trên desktop */}
      <section aria-label="Lọc danh sách bill tiệc" className="card mb-3 !p-0 sm:mb-6">
        <div className="flex flex-col gap-3 p-2 sm:p-4 lg:flex-row lg:flex-wrap lg:items-end lg:gap-x-5 lg:gap-y-3">
          {/* Dates */}
          <div id="party-filter-dates" className={`${mobileFiltersOpen ? "grid" : "hidden"} min-w-0 grid-cols-2 gap-2 sm:grid sm:gap-3 lg:flex`}>
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
          <div id="party-filter-name" className={`${mobileFiltersOpen ? "block" : "hidden"} sm:block lg:min-w-[200px] lg:flex-1`}>
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
              <button
                type="button"
                onClick={() => setMobileFiltersOpen((open) => !open)}
                aria-expanded={mobileFiltersOpen}
                aria-controls="party-filter-dates party-filter-name party-filter-options"
                aria-label="Bộ lọc nâng cao"
                className="btn btn-ghost gap-1 px-2 text-xs sm:hidden"
              >
                Lọc
                {(filters.date_from || filters.date_to || filters.name || filters.limit !== 10) && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-label="Có bộ lọc nâng cao đang áp dụng" />
                )}
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${mobileFiltersOpen ? "rotate-180" : ""}`} />
              </button>
            </div>
          </div>

          {/* Limit + Clear — đẩy sang phải trên desktop */}
          <div id="party-filter-options" className={`${mobileFiltersOpen ? "grid" : "hidden"} grid-cols-2 gap-2 sm:grid sm:gap-3 lg:ml-auto lg:flex lg:items-end`}>
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
        {!mobileFiltersOpen && (filters.date_from || filters.date_to || filters.name) && (
          <p className="break-words px-3 pb-2 text-xs text-slate-600 sm:hidden">
            {(filters.date_from || filters.date_to) && <>{filters.date_from ? formatDate(filters.date_from) : "Từ đầu"} – {filters.date_to ? formatDate(filters.date_to) : "hiện tại"}</>}
            {filters.name && <>{filters.date_from || filters.date_to ? " · " : ""}Tên: {filters.name}</>}
          </p>
        )}
      </section>

      {/* Main content: bills list (3/4) + unpaid sidebar (1/4) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Bills column */}
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
              <div className="divide-y divide-slate-100 md:hidden">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="space-y-2 px-3 py-3">
                    <div className="flex items-center justify-between gap-4">
                      <div className="skeleton h-4 w-24" />
                      <div className="skeleton h-5 w-28" />
                    </div>
                    <div className="skeleton h-3 w-32" />
                    <div className="skeleton h-3 w-40" />
                  </div>
                ))}
              </div>
            </div>
          ) : paginatedBills.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title="Chưa có bill tiệc nào"
              description="Thử xóa bộ lọc hoặc tạo bill tiệc mới để bắt đầu."
              action={
                <Link to="/party-bills/create" className="btn btn-primary">
                  <Plus className="h-4 w-4" />
                  Tạo bill đầu tiên
                </Link>
              }
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
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
                              {status !== "paid" && (
                                <Link
                                  to={`/party-bills/${bill.id}/edit`}
                                  className="whitespace-nowrap text-sm font-medium text-slate-600 hover:text-slate-900"
                                >
                                  Sửa
                                </Link>
                              )}
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
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="divide-y divide-slate-200 md:hidden">
                {paginatedBills.map((bill) => {
                  const status = getBillStatus(bill);
                  const meta = getStatusMeta(status);
                  const totalFood = (bill.participants || []).reduce(
                    (sum, p) => sum + (Number(p.food_amount) || 0),
                    0,
                  );
                  const totalWithFood = (bill.total_amount || 0) + totalFood;
                  const unpaidCount = getUnpaidCount(bill);
                  const overdue = isBillOverdue(bill);
                  return (
                    <article
                      key={bill.id}
                      className="overflow-hidden"
                    >
                      <div
                        className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-2 p-3 ${
                          overdue
                            ? "bg-rose-50/70"
                            : status === "paid"
                              ? "bg-emerald-50/50"
                              : "bg-white"
                        }`}
                      >
                        <div className="col-span-2 mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-medium text-slate-500">
                              {formatDate(bill.date)}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <h3 className="truncate text-sm font-semibold text-slate-900">
                                {bill.name || "—"}
                              </h3>
                              {overdue && (
                                <span className="badge badge-rose gap-1">
                                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />
                                  Quá hạn
                                </span>
                              )}
                            </div>
                            {bill.note && (
                              <div className="mt-1 text-xs text-slate-500 line-clamp-1">
                                {bill.note}
                              </div>
                            )}
                          </div>
                          <span aria-label={meta.text} className={`badge gap-1.5 whitespace-nowrap ${meta.cls}`}>
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                            />
                            {status === "partial" ? "TT 1 phần" : status === "paid" ? "Đã TT" : "Chưa TT"}
                          </span>
                        </div>

                        <div className="col-start-1 font-tabular text-lg font-semibold leading-tight text-slate-900">
                          {formatCurrencyRounded(totalWithFood)}
                        </div>
                        <div className="col-start-1 mt-1 text-xs text-slate-500">
                          {unpaidCount > 0 ? (
                            <>
                              <span className="font-semibold text-slate-700">
                                {unpaidCount}
                              </span>{" "}
                              người chưa TT
                            </>
                          ) : (
                            <span className="font-medium text-emerald-700">
                              Tất cả đã thanh toán
                            </span>
                          )}
                        </div>

                        <div className="col-start-2 row-start-2 row-span-2 flex items-center gap-0.5">
                          <Link
                            to={`/party-bills/${bill.id}`}
                            aria-label={`Chi tiết bill tiệc #${bill.id}`}
                            className="btn btn-ghost btn-icon text-emerald-700 sm:h-11 sm:w-11"
                          >
                            <span className="sr-only">Chi tiết</span>
                            <ChevronLeft className="h-4 w-4 rotate-180" />
                          </Link>
                          {status !== "paid" && (
                            <Link
                              to={`/party-bills/${bill.id}/edit`}
                              aria-label={`Sửa bill #${bill.id}`}
                              className="btn btn-ghost btn-icon sm:h-11 sm:w-11"
                            >
                              <Pencil className="h-[18px] w-[18px]" />
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({ isOpen: true, id: bill.id })
                            }
                            aria-label={`Xóa bill #${bill.id}`}
                            className="btn btn-danger-ghost btn-icon sm:h-11 sm:w-11"
                          >
                            <Trash2 className="h-[18px] w-[18px]" />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
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
          )}
        </div>

        {/* Unpaid sidebar */}
        <div className="lg:col-span-1">
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
                      <label className="absolute right-1 top-1 flex h-11 w-11 cursor-pointer items-center justify-center sm:right-2">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() =>
                            handleMarkParticipantPayment(p.userId)
                          }
                          disabled={isMarking}
                          aria-label={`Đánh dấu ${p.name} đã thanh toán tất cả bills`}
                          className="h-6 w-6 cursor-pointer accent-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Đánh dấu thanh toán tất cả bills"
                        />
                      </label>
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
        onClose={() => setDeleteConfirm({ isOpen: false, id: null })}
        onConfirm={async () => {
          await handleDelete(deleteConfirm.id);
          setDeleteConfirm({ isOpen: false, id: null });
        }}
        title="Xác nhận xóa"
        message="Bạn có chắc chắn muốn xóa bill tiệc này?"
      />

      {/* Mobile FAB */}
      <Link
        to="/party-bills/create"
        aria-label="Tạo Bill tiệc mới"
        className="fab-enter fixed bottom-[calc(4.25rem+env(safe-area-inset-bottom))] right-3 z-30 sm:bottom-5 sm:right-5 inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-fab transition-all active:scale-95 hover:bg-emerald-800 md:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.25} />
      </Link>
    </div>
  );
}
