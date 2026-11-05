import { CircleAlert } from "../ui/icons";
import { formatCurrencyRounded } from "../../utils/formatters";
import { stockTileParts } from "../../utils/shuttleStock";

/**
 * Hai ô tóm tắt đầu màn "Bill cầu" (M11), dưới lg (từ lg cột phải hiện đủ hai khối):
 * "Còn phải thu" mở sheet DS chưa thanh toán, "Cầu khả dụng" mở sheet tồn cầu.
 * Số "Còn phải thu" tính trên dữ liệu đã lọc ngày (như khối DS chưa thanh toán) nên có dòng ghi
 * chú khi đang lọc ngày.
 */
export default function DashboardSummary({
  unpaidTotal,
  unpaidCount,
  stockBalls,
  lowStock,
  loadingBills,
  loadingShuttles,
  dateFiltered,
  onOpenUnpaid,
  onOpenStock,
}) {
  const stock = stockTileParts(stockBalls);

  return (
    <div className="mb-3 lg:hidden">
      <div className="grid grid-cols-2 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={onOpenUnpaid}
          aria-haspopup="dialog"
          className="stat-tile"
        >
          <span className="stat-tile-label">Còn phải thu</span>
          {loadingBills ? (
            <>
              <span className="skeleton mt-1.5 h-6 w-24" />
              <span className="skeleton mt-1.5 h-3.5 w-20" />
            </>
          ) : (
            <>
              <span className="stat-tile-value text-lg text-rose-700 min-[400px]:text-xl">
                {formatCurrencyRounded(unpaidTotal)}
              </span>
              <span className="stat-tile-sub">{unpaidCount} người chưa TT</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={onOpenStock}
          aria-haspopup="dialog"
          className={`stat-tile ${lowStock && !loadingShuttles ? "border-rose-200 bg-rose-50 active:bg-rose-100" : ""}`}
        >
          <span className="stat-tile-label">Cầu khả dụng</span>
          {loadingShuttles ? (
            <>
              <span className="skeleton mt-1.5 h-6 w-16" />
              <span className="skeleton mt-1.5 h-3.5 w-24" />
            </>
          ) : (
            <>
              <span
                className={`stat-tile-value flex items-center gap-1 text-lg min-[400px]:text-xl ${lowStock ? "text-rose-700" : ""}`}
              >
                {lowStock && (
                  <CircleAlert
                    className="h-5 w-5 flex-none"
                    aria-hidden="true"
                  />
                )}
                {stock.value}
              </span>
              {lowStock ? (
                <span className="stat-tile-sub font-medium text-rose-700">
                  Cần nhập thêm
                </span>
              ) : (
                stock.sub && <span className="stat-tile-sub">{stock.sub}</span>
              )}
            </>
          )}
        </button>
      </div>
      {dateFiltered && (
        <p className="mt-1.5 px-1 text-xs text-slate-500">
          Theo khoảng ngày đang lọc
        </p>
      )}
    </div>
  );
}
