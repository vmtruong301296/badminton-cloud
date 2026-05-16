import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { partyBillsApi } from "../../services/api";
import {
  formatCurrencyRounded,
  formatDate,
  roundToNearestThousand,
} from "../../utils/formatters";
import ConfirmDialog from "../../components/common/ConfirmDialog";

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
        cls: "bg-emerald-100 text-emerald-800",
        dot: "bg-emerald-500",
      };
    if (status === "partial")
      return {
        text: "Thanh toán 1 phần",
        cls: "bg-amber-100 text-amber-800",
        dot: "bg-amber-500",
      };
    return {
      text: "Chưa thanh toán",
      cls: "bg-slate-100 text-slate-700",
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
    <div className="px-2 sm:px-0 pb-24 md:pb-0">
      {/* Header */}
      <header className="mb-5 sm:mb-8">
        <div className="flex items-center justify-between gap-3 sm:items-end sm:gap-4">
          <div className="min-w-0 flex-1">
            <p className="hidden text-xs font-medium uppercase tracking-[0.18em] text-emerald-700/80 sm:block">
              Quản lý chia tiệc
            </p>
            <h1 className="font-display text-xl font-semibold leading-tight text-slate-900 sm:mt-1 sm:text-4xl">
              Danh sách Bills tiệc
            </h1>
            <p className="mt-0.5 text-xs text-slate-500 sm:mt-1.5 sm:text-sm">
              {loading ? (
                <span className="skeleton inline-block h-3.5 w-24 align-middle" />
              ) : (
                <>
                  <span className="font-tabular font-semibold text-slate-700">
                    {totalBillsCount}
                  </span>{" "}
                  bill hiển thị
                  {filters.date_from || filters.date_to ? " theo bộ lọc" : ""}
                </>
              )}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <Link
              to="/party-bills/create"
              className="hidden h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-card transition hover:bg-emerald-700 hover:shadow-card-hover sm:inline-flex"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
              Tạo Bill tiệc
            </Link>
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-card">
        <div className="flex flex-col gap-5 p-4 sm:p-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-[1fr_1fr_1fr_auto_auto] lg:items-end lg:gap-4">
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Từ ngày
              </label>
              <input
                type="date"
                value={filters.date_from}
                onChange={(e) =>
                  setFilters({ ...filters, date_from: e.target.value })
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Đến ngày
              </label>
              <input
                type="date"
                value={filters.date_to}
                onChange={(e) =>
                  setFilters({ ...filters, date_to: e.target.value })
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <div className="col-span-2 lg:col-span-1">
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Tên tiệc
              </label>
              <input
                type="text"
                value={filters.name}
                onChange={(e) =>
                  setFilters({ ...filters, name: e.target.value })
                }
                placeholder="Tìm theo tên/nội dung tiệc..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Số bill / trang
              </label>
              <select
                value={filters.limit}
                onChange={(e) =>
                  setFilters({ ...filters, limit: parseInt(e.target.value) })
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-3 text-sm font-medium text-slate-900 transition focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 lg:w-28"
              >
                {[10, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-span-2 flex items-end lg:col-span-1">
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
                className="inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:px-4 lg:w-auto"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                </svg>
                <span className="sm:hidden">Xóa lọc</span>
                <span className="hidden sm:inline">Xóa bộ lọc</span>
              </button>
            </div>
          </div>

          {/* Status chips */}
          <div>
            <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              Trạng thái
            </label>
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
                const isActive =
                  Array.isArray(filters.status) &&
                  filters.status.includes(opt.value);
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
                    className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-full border px-2 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 sm:h-11 sm:gap-2 sm:px-4 sm:text-sm ${
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
        </div>
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
          ) : paginatedBills.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-card">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <svg
                  width="28"
                  height="28"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              </div>
              <h3 className="font-display text-xl font-semibold text-slate-900">
                Chưa có bill tiệc nào
              </h3>
              <p className="mt-1.5 text-sm text-slate-500">
                Thử xóa bộ lọc hoặc tạo bill tiệc mới để bắt đầu.
              </p>
              <Link
                to="/party-bills/create"
                className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-card transition hover:bg-emerald-700 hover:shadow-card-hover"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Tạo bill đầu tiên
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card">
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Ngày
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Tên/Nội dung
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Tổng tiền
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Trạng thái
                      </th>
                      <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        Chưa TT
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
                          <td className="px-5 py-4 text-sm text-slate-700">
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
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}
                            >
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
                                className="text-sm font-medium text-emerald-700 hover:text-emerald-900"
                              >
                                Chi tiết
                              </Link>
                              {status !== "paid" && (
                                <Link
                                  to={`/party-bills/${bill.id}/edit`}
                                  className="text-sm font-medium text-amber-700 hover:text-amber-900"
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
                                className="text-sm font-medium text-rose-600 hover:text-rose-800"
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
              <div className="md:hidden space-y-3 p-3">
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
                      className={`overflow-hidden rounded-2xl border transition ${
                        overdue
                          ? "border-rose-300 ring-1 ring-rose-100"
                          : status === "paid"
                            ? "border-emerald-300 ring-1 ring-emerald-50"
                            : "border-slate-200"
                      }`}
                    >
                      <div
                        className={`p-4 ${
                          overdue
                            ? "bg-rose-50/70"
                            : status === "paid"
                              ? "bg-emerald-50/50"
                              : "bg-white"
                        }`}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                              {formatDate(bill.date)}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <h3 className="truncate font-display text-base font-semibold text-slate-900">
                                {bill.name || "—"}
                              </h3>
                              {overdue && (
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-rose-700">
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
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${meta.cls}`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
                            />
                            {meta.text}
                          </span>
                        </div>

                        <div className="font-display font-tabular text-2xl font-semibold leading-tight text-slate-900">
                          {formatCurrencyRounded(totalWithFood)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {unpaidCount > 0 ? (
                            <>
                              <span className="font-semibold text-slate-700">
                                {unpaidCount}
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
                          <Link
                            to={`/party-bills/${bill.id}`}
                            className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-sm font-semibold text-white shadow-card transition active:scale-[0.98] hover:bg-emerald-700"
                          >
                            Chi tiết
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M5 12h14M13 5l7 7-7 7" />
                            </svg>
                          </Link>
                          {status !== "paid" && (
                            <Link
                              to={`/party-bills/${bill.id}/edit`}
                              aria-label={`Sửa bill #${bill.id}`}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-amber-700 transition active:scale-[0.96] hover:border-amber-200 hover:bg-amber-50"
                            >
                              <svg
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden
                              >
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </Link>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setDeleteConfirm({ isOpen: true, id: bill.id })
                            }
                            aria-label={`Xóa bill #${bill.id}`}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition active:scale-[0.96] hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                          >
                            <svg
                              width="18"
                              height="18"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              aria-hidden
                            >
                              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            </svg>
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
                        className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M15 18l-6-6 6-6" />
                        </svg>
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
                                className={`inline-flex h-10 min-w-10 items-center justify-center rounded-xl border px-2 text-sm font-medium font-tabular transition ${
                                  currentPage === page
                                    ? "border-emerald-600 bg-emerald-600 text-white shadow-card"
                                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
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
                        className="inline-flex h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-40"
                      >
                        <span className="hidden sm:inline">Sau</span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M9 18l6-6-6-6" />
                        </svg>
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
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
                  Tất cả đã thanh toán 🎉
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
                      <div className="absolute right-4 top-3">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() =>
                            handleMarkParticipantPayment(p.userId)
                          }
                          disabled={isMarking}
                          className="h-6 w-6 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Đánh dấu thanh toán tất cả bills"
                        />
                      </div>
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
        className="fab-enter fixed bottom-5 right-5 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-fab transition-all active:scale-95 hover:bg-emerald-700 md:hidden"
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
      </Link>
    </div>
  );
}
