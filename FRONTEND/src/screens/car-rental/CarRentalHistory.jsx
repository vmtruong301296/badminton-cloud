import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { carRentalsApi } from "../../services/api";
import {
  formatCurrency,
  formatDateDisplay,
  formatNumber,
} from "../../utils/formatters";
import { useAuth } from "../../contexts/AuthContext";
import OptionBreakdown from "../../components/car-rental/OptionBreakdown";
import EmptyState from "../../components/ui/EmptyState";
import { Car, ChevronDown } from "../../components/ui/icons";

export default function CarRentalHistory({ reloadKey, onEdit }) {
  const { hasPermission } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

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

  const handleDelete = async (item) => {
    const label = item.name || `bản ghi #${item.id}`;
    if (!window.confirm(`Xóa ${label}?`)) return;

    setDeletingId(item.id);
    try {
      await carRentalsApi.delete(item.id);
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    } catch {
      setError("Không xóa được. Thử lại giúp mình.");
    } finally {
      setDeletingId(null);
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
      <EmptyState icon={Car} title="Chưa có lần so sánh nào được lưu." />
    );
  }

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
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-card"
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
                  <OptionBreakdown options={item.options ?? []} />
                </div>

                {item.total_shared_cost > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-2 font-semibold text-slate-900">
                      Tổng chi phí chuyến đi
                    </h4>
                    <div className="mb-2 max-w-xs space-y-0.5 text-sm text-slate-600">
                      {(item.shared_costs ?? []).map((row) => (
                        <div
                          key={row.id}
                          className="flex justify-between gap-3"
                        >
                          <span className="min-w-0 break-words">{row.name}</span>
                          <span className="font-tabular flex-shrink-0">{formatCurrency(row.amount)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between gap-3 border-t border-slate-200 pt-1 font-medium text-slate-900">
                        <span>Chi phí chung</span>
                        <span className="font-tabular">{formatCurrency(item.total_shared_cost)}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {(item.options ?? []).map((option) => (
                        <div
                          key={option.id}
                          className={`flex flex-wrap items-baseline justify-between gap-2 rounded-xl px-3 py-2 ${
                            option.is_cheapest ? "bg-emerald-50" : ""
                          }`}
                        >
                          <span className="font-medium text-slate-900">
                            {option.name}
                            {option.is_cheapest && (
                              <span className="badge badge-emerald ml-2">Rẻ nhất</span>
                            )}
                          </span>
                          <span className="text-slate-900">
                            <span className="font-tabular font-semibold">
                              {formatCurrency(option.trip_total_cost)}
                            </span>
                            {item.people_count > 0 && !item.party_bill && (
                              <span className="font-tabular text-slate-600">
                                {" · "}
                                {formatCurrency(option.per_person_cost)}/người
                              </span>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-3 space-y-1 text-sm text-slate-600">
                  {item.break_even_km !== null && (
                    <div>
                      Điểm hòa vốn: {formatNumber(item.break_even_km)} km
                    </div>
                  )}
                  {item.people_count > 0 && (
                    <div>Chia {item.people_count} người</div>
                  )}
                  {item.note && <div>Ghi chú: {item.note}</div>}
                  {item.creator && <div>Người tạo: {item.creator.name}</div>}
                  {item.party_bill && (
                    <div>
                      Gắn với bill tiệc:{" "}
                      <Link
                        to={`/party-bills/${item.party_bill.id}`}
                        className="text-sky-700 underline"
                      >
                        {item.party_bill.name || `Bill #${item.party_bill.id}`}
                      </Link>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {hasPermission("car_rentals.update") && (
                    <button
                      type="button"
                      onClick={() => onEdit?.(item)}
                      className="btn btn-secondary"
                    >
                      Nạp vào máy tính
                    </button>
                  )}
                  {hasPermission("car_rentals.delete") && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
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
    </div>
  );
}
