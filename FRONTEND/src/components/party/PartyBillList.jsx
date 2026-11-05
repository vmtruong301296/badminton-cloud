import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { formatCurrencyRounded, formatDateShort } from "../../utils/formatters";
import {
  isPartyBillOverdue,
  partyBillStatus,
  partyUnpaidCount,
} from "../../utils/partyBillList";
import { partyBillGrandTotal } from "../../utils/partyBillTotals";

const STATUS_BADGES = {
  paid: { className: "badge-emerald", dot: "bg-emerald-500", text: "Đã TT" },
  partial: { className: "badge-amber", dot: "bg-amber-500", text: "TT 1 phần" },
  unpaid: { className: "badge-slate", dot: "bg-slate-400", text: "Chưa TT" },
};
const OVERDUE_BADGE = {
  className: "badge-rose",
  dot: "bg-rose-500",
  text: "Quá hạn",
};
// Quá hạn: vạch hồng mép trái như danh sách bill cầu (không tô cả hàng).
const OVERDUE_BAR = "shadow-[inset_4px_0_0_theme(colors.rose.500)]";

/** Một hàng bill tiệc (M3): cả hàng mở chi tiết, không nút Sửa / Xóa (ở màn chi tiết). */
function PartyBillRow({ bill, today, index }) {
  const overdue = isPartyBillOverdue(bill, today);
  const status = partyBillStatus(bill);
  const badge = overdue
    ? OVERDUE_BADGE
    : STATUS_BADGES[status] || STATUS_BADGES.unpaid;
  const unpaid = partyUnpaidCount(bill);
  const progress =
    unpaid > 0 ? `${unpaid} người chưa TT` : "Tất cả đã thanh toán";

  return (
    <Link
      to={`/party-bills/${bill.id}`}
      data-entry-index={index}
      className={`list-row pr-4 ${overdue ? OVERDUE_BAR : ""}`}
    >
      <div className="list-row-text">
        <div className="list-row-title">{bill.name || "—"}</div>
        <div className="list-row-sub">
          {formatDateShort(bill.date, today)} · {progress}
        </div>
      </div>
      <div className="list-row-end">
        <span className="amount text-slate-900">
          {formatCurrencyRounded(partyBillGrandTotal(bill))}
        </span>
        <span className={`badge gap-1 ${badge.className}`}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
            aria-hidden="true"
          />
          {badge.text}
        </span>
      </div>
    </Link>
  );
}

/**
 * Danh sách bill tiệc trên điện thoại / máy tính bảng dọc (dưới md): hàng M3, "Xem thêm" thay
 * phân trang (quyết định 14). bills: phần đang hiện; totalCount: số bill sau lọc.
 */
export default function PartyBillList({
  bills,
  totalCount,
  pageSize,
  onShowMore,
}) {
  const today = new Date();
  const listRef = useRef(null);
  const focusFromRef = useRef(null);
  const shownCount = bills.length;

  // Sau "Xem thêm": đưa focus tới hàng mới đầu tiên để người dùng bàn phím không mất chỗ.
  useEffect(() => {
    if (focusFromRef.current === null) return;
    const target = listRef.current?.querySelector(
      `[data-entry-index="${focusFromRef.current}"]`,
    );
    focusFromRef.current = null;
    target?.focus();
  }, [shownCount]);

  return (
    <div ref={listRef}>
      <ul className="list-card">
        {bills.map((bill, index) => (
          <li key={bill.id}>
            <PartyBillRow bill={bill} today={today} index={index} />
          </li>
        ))}
      </ul>

      {totalCount > pageSize && (
        <div className="mt-4 text-center">
          <p className="text-sm text-slate-500">
            Đang hiện{" "}
            <span className="font-tabular">
              {shownCount} / {totalCount}
            </span>{" "}
            bill
          </p>
          {shownCount < totalCount && (
            <button
              type="button"
              onClick={() => {
                focusFromRef.current = shownCount;
                onShowMore();
              }}
              className="btn btn-secondary mt-2 w-full"
            >
              Xem thêm
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Khung chờ theo đúng hình hàng, để trang không nhảy khi dữ liệu về. */
export function PartyBillListSkeleton({ className = "" }) {
  return (
    <div className={`list-card ${className}`} aria-hidden="true">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="list-row">
          <div className="list-row-text space-y-2">
            <div className="skeleton h-4 w-40" />
            <div className="skeleton h-3 w-32" />
          </div>
          <div className="list-row-end">
            <div className="skeleton h-5 w-24" />
            <div className="skeleton h-4 w-16" />
          </div>
        </div>
      ))}
    </div>
  );
}
