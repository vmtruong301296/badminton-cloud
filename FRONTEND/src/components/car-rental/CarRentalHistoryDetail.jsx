import { Link } from "react-router-dom";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import OptionBreakdown from "./OptionBreakdown";

/**
 * Chi tiết một lần so sánh thuê xe đã lưu (tab Lịch sử): bóc tách từng phương án,
 * tổng chi phí chuyến đi, điểm hòa vốn, ghi chú, bill tiệc đã gắn.
 *
 * Dùng ở hai chỗ, cùng nội dung: phần mở rộng tại chỗ của thẻ trên desktop và sheet
 * chi tiết trên điện thoại. Nút "Nạp vào máy tính" / "Xóa" do nơi dùng tự đặt.
 */
export default function CarRentalHistoryDetail({ item }) {
  return (
    <>
      <OptionBreakdown options={item.options ?? []} />

      {item.total_shared_cost > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 font-semibold text-slate-900">
            Tổng chi phí chuyến đi
          </h4>
          <div className="mb-2 max-w-xs space-y-0.5 text-sm text-slate-600">
            {(item.shared_costs ?? []).map((row) => (
              <div key={row.id} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">{row.name}</span>
                <span className="font-tabular flex-shrink-0">
                  {formatCurrency(row.amount)}
                </span>
              </div>
            ))}
            <div className="flex justify-between gap-3 border-t border-slate-200 pt-1 font-medium text-slate-900">
              <span>Chi phí chung</span>
              <span className="font-tabular">
                {formatCurrency(item.total_shared_cost)}
              </span>
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
          <div>Điểm hòa vốn: {formatNumber(item.break_even_km)} km</div>
        )}
        {item.people_count > 0 && <div>Chia {item.people_count} người</div>}
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
    </>
  );
}
