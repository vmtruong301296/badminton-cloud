import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Modal from "../ui/Modal";
import EmptyState from "../ui/EmptyState";
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Inbox,
  Loader,
  RotateCcw,
} from "../ui/icons";
import { formatCurrencyRounded, formatDateShort } from "../../utils/formatters";
import { isPlayerOverdue } from "../../utils/billList";

/** Kết quả "Đã trả hết" hiện ngay trong sheet (thông báo ngắn M8 nằm dưới lớp nền mờ của sheet). */
function SheetNotice({ notice, onRetry }) {
  const ref = useRef(null);

  // Người vừa trả hết rời danh sách nên nút đang focus biến mất: đưa focus về thông báo.
  useEffect(() => {
    ref.current?.focus();
  }, [notice]);

  const isError = notice.type === "error";
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={isError ? "alert" : "status"}
      className={`mb-3 flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none ${
        isError ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-800"
      }`}
    >
      {isError ? (
        <CircleAlert className="mt-px h-5 w-5 flex-none" />
      ) : (
        <CircleCheck className="mt-px h-5 w-5 flex-none" />
      )}
      <span className="min-w-0 flex-1 break-words">{notice.text}</span>
      {isError && onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-sm -my-1.5 flex-none text-rose-700 hover:bg-rose-100"
        >
          <RotateCcw className="h-4 w-4" />
          Thử lại
        </button>
      )}
    </div>
  );
}

/**
 * Sheet "DS chưa thanh toán" (dưới lg; từ lg là thẻ ở cột phải): mỗi người một hàng mở tại chỗ
 * (M3c, mỗi lúc một hàng) → các ngày thiếu (chạm để mở bill ngày đó) + "Đã trả hết" (có hỏi lại,
 * màn cha mở ConfirmDialog qua onPayAll).
 *
 * notice: { type: "success" | "error", text, onRetry? } — kết quả lần "Đã trả hết" gần nhất.
 */
export default function UnpaidPlayersSheet({
  isOpen,
  onClose,
  players,
  total,
  loading,
  canView,
  canMark,
  markingIds,
  onPayAll,
  notice,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const today = new Date();

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`DS chưa thanh toán (${players.length})`}
      initialFocus="panel"
    >
      {notice && <SheetNotice notice={notice} onRetry={notice.onRetry} />}
      <p className="text-sm text-slate-600">
        Tổng:{" "}
        <span className="amount-lg ml-1 text-rose-700">
          {formatCurrencyRounded(total)}
        </span>
      </p>

      {loading ? (
        <p className="py-8 text-center text-sm text-slate-500">Đang tải...</p>
      ) : players.length === 0 ? (
        <div className="mt-3">
          <EmptyState
            compact
            icon={Inbox}
            title="Không có người chơi nào chưa thanh toán"
          />
        </div>
      ) : (
        <ul className="-mx-5 mt-3 border-t border-slate-100">
          {players.map((player) => {
            const open = expandedId === player.userId;
            const panelId = `unpaid-player-${player.userId}`;
            const marking = markingIds.has(player.userId);
            return (
              <li
                key={player.userId}
                className="border-b border-slate-100 last:border-b-0"
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setExpandedId(open ? null : player.userId)}
                  className="list-row pl-5 pr-4"
                >
                  <div className="list-row-text">
                    <div className="list-row-title whitespace-normal break-words">
                      {player.name}
                    </div>
                    <div className="list-row-sub">
                      {player.unpaidDates.length} ngày thiếu
                      {isPlayerOverdue(player, today) && (
                        <span className="text-rose-700"> · Quá hạn</span>
                      )}
                    </div>
                  </div>
                  <span className="amount self-start pt-px text-rose-700">
                    {formatCurrencyRounded(player.totalAmount)}
                  </span>
                  <ChevronDown className="list-row-chevron self-start mt-1" />
                </button>
                {open && (
                  <div id={panelId} className="list-row-panel px-5 pt-1">
                    <ul className="divide-y divide-slate-200/70">
                      {player.unpaidDates.map((item) => {
                        const row = (
                          <>
                            <span className="min-w-0 flex-1 text-slate-700">
                              {formatDateShort(item.date, today)}
                            </span>
                            <span className="font-tabular text-slate-700">
                              {formatCurrencyRounded(item.amount)}
                            </span>
                          </>
                        );
                        return (
                          <li key={item.date}>
                            {canView ? (
                              <Link
                                to={`/bills/${item.billId}`}
                                className="-mx-2 flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                              >
                                {row}
                                <ChevronRight className="h-4 w-4 flex-none text-slate-300" />
                              </Link>
                            ) : (
                              <div className="flex min-h-11 items-center gap-2 text-sm">
                                {row}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                    {canMark && (
                      <button
                        type="button"
                        onClick={() => onPayAll(player)}
                        disabled={marking}
                        aria-label={`Đã trả hết: ${player.name}`}
                        className="btn btn-secondary mt-2 w-full border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                      >
                        {marking ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                        Đã trả hết
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
