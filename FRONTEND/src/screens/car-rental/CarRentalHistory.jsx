import { useCallback, useEffect, useState } from "react";
import { carRentalsApi } from "../../services/api";
import {
  formatCurrency,
  formatDateDisplay,
  formatDateShort,
  formatNumber,
} from "../../utils/formatters";
import { useAuth } from "../../contexts/AuthContext";
import CarRentalHistoryDetail from "../../components/car-rental/CarRentalHistoryDetail";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import EmptyState from "../../components/ui/EmptyState";
import Modal from "../../components/ui/Modal";
import useToast from "../../components/ui/useToast";
import { Car, ChevronDown, CircleAlert } from "../../components/ui/icons";

const DELETE_ERROR = "Không xóa được. Thử lại giúp mình.";

const itemTitle = (item) => item.name || `Bản ghi #${item.id}`;

const findCheapest = (item) =>
  (item.options ?? []).find((option) => option.is_cheapest);

export default function CarRentalHistory({ reloadKey, onEdit, onNew }) {
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  // Điện thoại: hàng M3 mở sheet chi tiết (thay phần mở rộng tại chỗ của desktop).
  const [sheetId, setSheetId] = useState(null);
  const [sheetError, setSheetError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const canUpdate = hasPermission("car_rentals.update");
  const canDelete = hasPermission("car_rentals.delete");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await carRentalsApi.getAll();
      setItems(response.data ?? []);
    } catch {
      setError("Không tải được lịch sử. Thử lại giúp mình.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load, reloadKey]);

  const openSheet = (id) => {
    setSheetError("");
    setSheetId(id);
  };

  const handleDelete = async () => {
    const item = deleteTarget;
    const fromSheet = sheetId === item.id;

    setDeletingId(item.id);
    try {
      await carRentalsApi.delete(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
      if (fromSheet) setSheetId(null);
    } catch {
      // Sheet đang mở thì báo ngay trong sheet (thông báo M8 nằm dưới lớp nền mờ).
      if (fromSheet) setSheetError(DELETE_ERROR);
      else toast.error(DELETE_ERROR);
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-sm text-slate-500">Đang tải...</div>;
  }

  if (error) {
    return (
      <div className="card py-8 text-center">
        <div role="alert" className="mb-3 text-sm text-rose-600">{error}</div>
        <button
          type="button"
          onClick={load}
          className="btn btn-primary"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <EmptyState
        icon={Car}
        title="Chưa có lần so sánh nào được lưu."
        action={
          onNew && (
            <button type="button" onClick={onNew} className="btn btn-primary">
              Tính chuyến mới
            </button>
          )
        }
      />
    );
  }

  const sheetItem = items.find((item) => item.id === sheetId) ?? null;

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const cheapest = (item.options ?? []).find(
          (option) => option.is_cheapest,
        );
        const expanded = expandedId === item.id;

        return (
          <div
            key={item.id}
            // sm trở lên: giữ thẻ mở rộng tại chỗ như cũ (điện thoại dùng hàng M3 bên dưới).
            className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card sm:block"
          >
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : item.id)}
              aria-expanded={expanded}
              className="flex w-full items-start gap-3 p-4 text-left hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 break-words font-semibold text-slate-900">
                    {item.name || `Bản ghi #${item.id}`}
                  </span>
                  <span className="text-sm text-slate-500">
                    {item.date ? formatDateDisplay(item.date) : "Không ghi ngày"}
                  </span>
                </div>
                <div className="mt-1 text-sm text-slate-600">
                  {item.days} ngày · {formatNumber(item.distance_km)} km
                  {cheapest && (
                    <>
                      {" · Rẻ nhất: "}
                      <span className="font-tabular font-medium text-emerald-700">
                        {cheapest.name} {formatCurrency(cheapest.total_cost)}
                      </span>
                    </>
                  )}
                  {item.saving_amount > 0 &&
                    ` · Tiết kiệm ${formatCurrency(item.saving_amount)}`}
                  {item.total_shared_cost > 0 &&
                    ` · Chi phí chung ${formatCurrency(item.total_shared_cost)}`}
                </div>
              </div>
              <ChevronDown
                className={`mt-1 h-5 w-5 flex-shrink-0 text-slate-400 transition-transform ${
                  expanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {expanded && (
              <div className="border-t border-slate-100 px-4 pb-4">
                <div className="mt-3">
                  <CarRentalHistoryDetail item={item} />
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => onEdit?.(item)}
                      className="btn btn-secondary"
                    >
                      Nạp vào máy tính
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(item)}
                      disabled={deletingId === item.id}
                      className="btn btn-danger-ghost"
                    >
                      {deletingId === item.id ? "Đang xóa..." : "Xóa"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Điện thoại: hàng M3 — tên (tối đa 2 dòng), ngày · số ngày · km, phương án rẻ nhất;
          chạm cả hàng mở sheet chi tiết */}
      <ul className="list-card !mt-0 sm:hidden">
        {items.map((item) => {
          const cheapest = findCheapest(item);

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => openSheet(item.id)}
                aria-haspopup="dialog"
                className="list-row min-h-[72px]"
              >
                <div className="list-row-text">
                  <div className="list-row-title line-clamp-2 whitespace-normal">
                    {itemTitle(item)}
                  </div>
                  <div className="list-row-sub whitespace-normal">
                    {item.date ? formatDateShort(item.date) : "Không ghi ngày"}
                    {" · "}
                    {item.days} ngày · {formatNumber(item.distance_km)} km
                  </div>
                  {cheapest && (
                    <div className="list-row-sub text-emerald-700">
                      Rẻ nhất: {cheapest.name}
                    </div>
                  )}
                </div>
                <div className="list-row-end">
                  {cheapest && (
                    <span className="amount text-slate-900">
                      {formatCurrency(cheapest.total_cost)}
                    </span>
                  )}
                  {item.party_bill && (
                    <span className="badge badge-sky">Bill tiệc</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <Modal
        isOpen={Boolean(sheetItem)}
        onClose={() => setSheetId(null)}
        title={sheetItem && itemTitle(sheetItem)}
        initialFocus="panel"
        footer={
          sheetItem &&
          (canUpdate || canDelete) && (
            <div className="flex gap-2">
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setDeleteTarget(sheetItem)}
                  className={`btn btn-danger-soft ${canUpdate ? "" : "flex-1"}`}
                >
                  Xóa
                </button>
              )}
              {canUpdate && (
                <button
                  type="button"
                  onClick={() => {
                    setSheetId(null);
                    onEdit?.(sheetItem);
                  }}
                  className="btn btn-primary flex-1"
                >
                  Nạp vào máy tính
                </button>
              )}
            </div>
          )
        }
      >
        {sheetItem && (
          <>
            <p className="mb-3 text-sm text-slate-500">
              {sheetItem.date
                ? formatDateShort(sheetItem.date)
                : "Không ghi ngày"}
              {" · "}
              {sheetItem.days} ngày · {formatNumber(sheetItem.distance_km)} km
            </p>
            {sheetError && (
              <p role="alert" className="sheet-alert mb-3">
                <CircleAlert />
                <span>{sheetError}</span>
              </p>
            )}
            <CarRentalHistoryDetail item={sheetItem} />
          </>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        busy={Boolean(deleteTarget) && deletingId === deleteTarget.id}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Xóa lần so sánh"
        message={
          deleteTarget &&
          `Xóa ${deleteTarget.name || `bản ghi #${deleteTarget.id}`}?`
        }
      />
    </div>
  );
}
