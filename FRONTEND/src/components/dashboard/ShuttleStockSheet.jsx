import { Link } from "react-router-dom";
import Modal from "../ui/Modal";
import { CircleAlert } from "../ui/icons";
import { formatShuttleStock, LOW_STOCK_TUBES } from "../../utils/shuttleStock";

/**
 * Sheet "Cầu khả dụng" (dưới lg; từ lg là thẻ ở cột phải): tổng tồn, cảnh báo dưới 10 ống, từng
 * loại còn tồn. "Nhập kho" chỉ khi có quyền shuttles.view.
 */
export default function ShuttleStockSheet({
  isOpen,
  onClose,
  shuttleTypes,
  stockedTypes,
  totalBalls,
  lowStock,
  loading,
  canImport,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cầu khả dụng"
      initialFocus="panel"
      footer={
        canImport && (
          <Link to="/master?tab=shuttles" className="btn btn-secondary w-full">
            Nhập kho
          </Link>
        )
      }
    >
      <p className="text-sm text-slate-600">
        Tổng:{" "}
        <span
          className={`ml-1 text-base font-semibold ${lowStock ? "text-rose-700" : "text-emerald-700"}`}
        >
          {formatShuttleStock(totalBalls)}
        </span>
      </p>
      {lowStock && !loading && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
          <CircleAlert className="mt-0.5 h-5 w-5 flex-none text-rose-600" />
          <p className="text-sm font-medium text-rose-700">
            Tổng cầu còn lại dưới {LOW_STOCK_TUBES} ống — cần nhập thêm!
          </p>
        </div>
      )}
      <div className="mt-2 divide-y divide-slate-100">
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Đang tải...</p>
        ) : shuttleTypes.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Chưa có loại cầu
          </p>
        ) : stockedTypes.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Không có loại cầu nào còn tồn kho
          </p>
        ) : (
          stockedTypes.map((type) => (
            <div key={type.id} className="py-3">
              <div className="break-words text-sm font-semibold text-slate-900">
                {type.name}
              </div>
              <div className="mt-0.5 text-sm text-slate-600">
                {formatShuttleStock(Number(type.stock_quantity) || 0)}
              </div>
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
