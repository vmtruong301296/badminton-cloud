import { useCallback, useEffect, useState } from "react";
import { carRentalsApi } from "../../services/api";
import { formatCurrency, formatDateDisplay, formatNumber } from "../../utils/formatters";
import { useAuth } from "../../contexts/AuthContext";

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
    return <div className="text-gray-600 py-8 text-center">Đang tải...</div>;
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <div className="text-red-600 mb-3">{error}</div>
        <button
          type="button"
          onClick={load}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Thử lại
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-gray-600 py-8 text-center">
        Chưa có lần so sánh nào được lưu.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const cheapest = (item.options ?? []).find((option) => option.is_cheapest);
        const expanded = expandedId === item.id;

        return (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId(expanded ? null : item.id)}
              className="w-full text-left p-4 hover:bg-slate-50"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-medium text-gray-900">
                  {item.name || `Bản ghi #${item.id}`}
                </span>
                <span className="text-sm text-gray-500">
                  {item.date ? formatDateDisplay(item.date) : "Không ghi ngày"}
                </span>
              </div>
              <div className="mt-1 text-sm text-gray-600">
                {item.days} ngày · {formatNumber(item.distance_km)} km
                {cheapest && (
                  <>
                    {" · Rẻ nhất: "}
                    <span className="text-green-700 font-medium">
                      {cheapest.name} {formatCurrency(cheapest.total_cost)}
                    </span>
                  </>
                )}
                {item.saving_amount > 0 && ` · Tiết kiệm ${formatCurrency(item.saving_amount)}`}
              </div>
            </button>

            {expanded && (
              <div className="px-4 pb-4 border-t border-slate-100">
                <div className="overflow-x-auto mt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-slate-200">
                        <th className="py-2 pr-3">Phương án</th>
                        <th className="py-2 px-3 text-right">Thuê</th>
                        <th className="py-2 px-3 text-right">Nhiên liệu</th>
                        <th className="py-2 px-3 text-right">Vượt km</th>
                        <th className="py-2 px-3 text-right">Khác</th>
                        <th className="py-2 px-3 text-right">Tổng</th>
                        <th className="py-2 pl-3 text-right">đ/km</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(item.options ?? []).map((option) => (
                        <tr
                          key={option.id}
                          className={`border-b border-slate-100 ${option.is_cheapest ? "bg-green-50" : ""}`}
                        >
                          <td className="py-2 pr-3 font-medium text-gray-900">{option.name}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(option.rental_cost)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(option.fuel_cost)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(option.over_km_cost)}</td>
                          <td className="py-2 px-3 text-right">{formatCurrency(option.extra_fixed_cost)}</td>
                          <td className="py-2 px-3 text-right font-semibold">
                            {formatCurrency(option.total_cost)}
                          </td>
                          <td className="py-2 pl-3 text-right">{formatCurrency(option.cost_per_km)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 text-sm text-gray-600 space-y-1">
                  {item.break_even_km !== null && (
                    <div>Điểm hòa vốn: {formatNumber(item.break_even_km)} km</div>
                  )}
                  {item.people_count > 0 && <div>Chia {item.people_count} người</div>}
                  {item.note && <div>Ghi chú: {item.note}</div>}
                  {item.creator && <div>Người tạo: {item.creator.name}</div>}
                </div>

                <div className="mt-4 flex flex-wrap gap-3">
                  {hasPermission("car_rentals.update") && (
                    <button
                      type="button"
                      onClick={() => onEdit?.(item)}
                      className="px-4 py-2 border border-slate-300 rounded-lg text-gray-700 hover:bg-slate-50"
                    >
                      Nạp vào máy tính
                    </button>
                  )}
                  {hasPermission("car_rentals.delete") && (
                    <button
                      type="button"
                      onClick={() => handleDelete(item)}
                      disabled={deletingId === item.id}
                      className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
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
