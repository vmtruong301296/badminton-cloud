import { formatCurrency } from "../../utils/formatters";

/**
 * Bảng bóc tách chi phí từng phương án thuê xe.
 *
 * Bảng 7 cột này rộng khoảng 750px, trong khi màn điện thoại 390px chỉ còn
 * ~326px dùng được — cuộn ngang hơn hai màn mới thấy cột "Tổng", đúng con số
 * người ta cần. Nên dưới breakpoint sm ta đổi hẳn sang thẻ: mỗi phương án một
 * thẻ, Tổng nằm trên cùng và to nhất. Từ sm trở lên vẫn là bảng như cũ vì lúc
 * đó so sánh theo cột mới là cách đọc nhanh nhất.
 */

const COLUMNS = [
  { key: "rental_cost", label: "Thuê" },
  { key: "fuel_cost", label: "Nhiên liệu" },
  { key: "over_km_cost", label: "Vượt km", hideWhenZero: true },
  { key: "extra_fixed_cost", label: "Khác", hideWhenZero: true },
];

const optionName = (option, index) => option.name || `Phương án ${index + 1}`;

export default function OptionBreakdown({ options }) {
  return (
    <>
      {/* Mobile: thẻ */}
      <div className="space-y-3 sm:hidden">
        {options.map((option, index) => (
          <div
            key={option.id ?? index}
            className={`rounded-xl border p-3 ${
              option.is_cheapest
                ? "border-emerald-300 bg-emerald-50"
                : "border-slate-200"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="min-w-0 break-words font-medium text-slate-900">
                {optionName(option, index)}
              </span>
              {option.is_cheapest && (
                <span className="badge shrink-0 bg-emerald-700 text-white">
                  Rẻ nhất
                </span>
              )}
            </div>

            <div className="font-tabular mt-1 text-xl font-semibold text-slate-900">
              {formatCurrency(option.total_cost)}
            </div>

            <dl className="mt-2 space-y-1 border-t border-slate-200 pt-2 text-sm">
              {COLUMNS.filter(
                (column) => !column.hideWhenZero || option[column.key] > 0,
              ).map((column) => (
                <div key={column.key} className="flex justify-between gap-2">
                  <dt className="text-slate-500">{column.label}</dt>
                  <dd className="font-tabular text-slate-900">
                    {formatCurrency(option[column.key])}
                  </dd>
                </div>
              ))}
              <div className="flex justify-between gap-2">
                <dt className="text-slate-500">đ/km</dt>
                <dd className="font-tabular text-slate-900">
                  {formatCurrency(option.cost_per_km)}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      {/* sm trở lên: giữ nguyên bảng */}
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
              <th className="py-2 pr-3 font-medium">Phương án</th>
              {COLUMNS.map((column) => (
                <th key={column.key} className="px-3 py-2 text-right font-medium">
                  {column.label}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium">Tổng</th>
              <th className="py-2 pl-3 text-right font-medium">đ/km</th>
            </tr>
          </thead>
          <tbody>
            {options.map((option, index) => (
              <tr
                key={option.id ?? index}
                className={`border-b border-slate-100 ${option.is_cheapest ? "bg-emerald-50" : ""}`}
              >
                <td className="py-2 pr-3 font-medium text-slate-900">
                  {optionName(option, index)}
                  {option.is_cheapest && (
                    <span className="badge ml-2 bg-emerald-700 text-white">
                      Rẻ nhất
                    </span>
                  )}
                </td>
                {COLUMNS.map((column) => (
                  <td key={column.key} className="font-tabular px-3 py-2 text-right">
                    {formatCurrency(option[column.key])}
                  </td>
                ))}
                <td className="font-tabular px-3 py-2 text-right font-semibold text-slate-900">
                  {formatCurrency(option.total_cost)}
                </td>
                <td className="font-tabular py-2 pl-3 text-right">
                  {formatCurrency(option.cost_per_km)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
