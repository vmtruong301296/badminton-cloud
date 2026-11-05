import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { formatCurrencyRounded, formatDateShort } from "../../utils/formatters";
import {
  billStatus,
  isBillOverdue,
  unpaidPlayerCount,
} from "../../utils/billList";

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
// Bill quá hạn: vạch hồng mép trái (không tô cả hàng — tháng cũ gần như hàng nào cũng quá hạn).
const OVERDUE_BAR = "shadow-[inset_4px_0_0_theme(colors.rose.500)]";

/** Một hàng bill (M3): cả hàng mở chi tiết, không nút Xóa (xóa ở màn chi tiết), không ›. */
function BillRow({ bill, isChild, orphanOf, canView, today, entryIndex }) {
  const overdue = isBillOverdue(bill, today);
  const badge = overdue ? OVERDUE_BADGE : STATUS_BADGES[billStatus(bill)];
  const unpaid = unpaidPlayerCount(bill);
  const playerCount = bill.bill_players?.length || 0;
  const progress =
    unpaid > 0
      ? `${unpaid}/${playerCount} người chưa TT`
      : "Tất cả đã thanh toán";
  const date = formatDateShort(bill.date, today);
  const amount = formatCurrencyRounded(bill.total_amount);
  const subBillNote = `Bill con${bill.note ? ` · ${bill.note}` : ""}`;
  // "của #id" cuối dòng: màn hẹp cắt "…" phần ít quan trọng nhất
  const sub = [`#${bill.id}`, progress, orphanOf && `của #${orphanOf}`]
    .filter(Boolean)
    .join(" · ");

  // Không có › như bản vẽ: cả hàng đã bấm được, ở 360 px cần chỗ cho "{a}/{b} người chưa TT".
  const className = `list-row pr-4 ${isChild ? "list-row-child" : ""} ${overdue ? OVERDUE_BAR : ""}`;
  const content = (
    <>
      <div className="list-row-text">
        <div className="list-row-title">
          {isChild ? (
            <>
              <span className="text-sky-700">Bill con</span>
              {bill.note && (
                <span className="font-normal text-slate-500">
                  {" "}
                  · {bill.note}
                </span>
              )}
            </>
          ) : (
            <>
              {date}
              {(bill.parent_bill_id || bill.note) && (
                <span className="ml-1.5 font-normal text-slate-500">
                  {bill.parent_bill_id ? subBillNote : bill.note}
                </span>
              )}
            </>
          )}
        </div>
        <div className="list-row-sub">{sub}</div>
      </div>
      <div className="list-row-end">
        <span className="amount text-slate-900">{amount}</span>
        <span className={`badge gap-1 ${badge.className}`}>
          <span
            className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
            aria-hidden="true"
          />
          {badge.text}
        </span>
      </div>
    </>
  );

  if (!canView) return <div className={className}>{content}</div>;

  return (
    <Link
      to={`/bills/${bill.id}`}
      className={className}
      data-entry-index={entryIndex}
      aria-label={`${bill.parent_bill_id ? "Bill con" : "Bill"} #${bill.id}, ${date}, ${amount}, ${progress}, ${badge.text}`}
    >
      {content}
    </Link>
  );
}

/**
 * Danh sách bill trên điện thoại / máy tính bảng dọc (dưới md): nhóm theo tháng có đầu nhóm dính
 * (M10), bill con ngay dưới bill chính, bill con mồ côi thành hàng riêng ghi "của #id",
 * "Xem thêm" thay phân trang.
 *
 * groups: kết quả takeEntries(groupEntriesByMonth(...)) — số liệu đầu nhóm là của cả tháng.
 * shownCount / totalCount: số hàng cấp ngoài đang hiện / tổng; onShowMore: hiện thêm.
 */
export default function MobileBillList({
  groups,
  shownCount,
  totalCount,
  pageSize,
  onShowMore,
  canView,
}) {
  const today = new Date();
  const listRef = useRef(null);
  const focusFromRef = useRef(null);

  // Sau "Xem thêm": đưa focus tới hàng mới đầu tiên để người dùng bàn phím không mất chỗ.
  useEffect(() => {
    if (focusFromRef.current === null) return;
    const target = listRef.current?.querySelector(
      `[data-entry-index="${focusFromRef.current}"]`,
    );
    focusFromRef.current = null;
    target?.focus();
  }, [shownCount]);

  // Thứ tự hàng cấp ngoài trên cả danh sách (để focus hàng mới sau "Xem thêm").
  const groupStart = (groupIndex) =>
    groups
      .slice(0, groupIndex)
      .reduce((sum, group) => sum + group.entries.length, 0);

  return (
    <div ref={listRef}>
      {groups.map((group, groupIndex) => (
        <section
          key={group.key}
          aria-labelledby={`bill-month-${group.key}`}
          className="mt-4 first:mt-0"
        >
          <h2 id={`bill-month-${group.key}`} className="group-head">
            <span className="group-head-title">
              Tháng {group.month}/{group.year}
            </span>
            <span className="group-head-meta">
              {group.billCount} bill ·{" "}
              {group.unpaidTotal > 0 ? (
                <>
                  còn thiếu{" "}
                  <span className="font-semibold text-rose-700">
                    {formatCurrencyRounded(group.unpaidTotal)}
                  </span>
                </>
              ) : (
                "đã thu đủ"
              )}
            </span>
          </h2>
          <ul className="list-card mt-1">
            {group.entries.flatMap((entry, i) => {
              const index = groupStart(groupIndex) + i;
              return [
                <li key={entry.bill.id}>
                  <BillRow
                    bill={entry.bill}
                    orphanOf={entry.orphanOf}
                    canView={canView}
                    today={today}
                    entryIndex={index}
                  />
                </li>,
                ...entry.children.map((child) => (
                  <li key={child.id}>
                    <BillRow
                      bill={child}
                      isChild
                      canView={canView}
                      today={today}
                    />
                  </li>
                )),
              ];
            })}
          </ul>
        </section>
      ))}

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

/** Khung chờ theo đúng hình hàng mới, để trang không nhảy khi dữ liệu về. */
export function MobileBillListSkeleton({ className = "" }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="flex h-9 items-center justify-between">
        <div className="skeleton h-3.5 w-24" />
        <div className="skeleton h-3 w-32" />
      </div>
      <div className="list-card mt-1">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="list-row">
            <div className="list-row-text space-y-2">
              <div className="skeleton h-4 w-24" />
              <div className="skeleton h-3 w-40" />
            </div>
            <div className="list-row-end">
              <div className="skeleton h-5 w-24" />
              <div className="skeleton h-4 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
