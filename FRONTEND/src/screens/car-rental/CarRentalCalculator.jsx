import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { calculateCarRental } from "../../utils/carRentalCost";
import {
  carRentalsApi,
  fuelPricesApi,
  partyBillsApi,
} from "../../services/api";
import { formatCurrency, formatNumber } from "../../utils/formatters";
import { useAuth } from "../../contexts/AuthContext";
import CurrencyInput from "../../components/common/CurrencyInput";
import ThousandHint from "../../components/common/ThousandHint";

/** Loại xăng mà giá thị trường lấy được áp cho. */
const PETROL_FUEL_KEY = "e10_ron95_iii";

/** Dùng khi API giá xăng lỗi. Khớp fallback_price trong config/fuel_prices.php. */
const FALLBACK_PETROL_PRICE = 22660;

const FUEL_TYPES = [
  { value: "petrol", label: "Xăng", unit: "L/100km", priceUnit: "đ/lít" },
  { value: "electric", label: "Điện", unit: "kWh/100km", priceUnit: "đ/kWh" },
  { value: "none", label: "Không tốn nhiên liệu", unit: "", priceUnit: "" },
];

const fuelMeta = (fuelType) =>
  FUEL_TYPES.find((item) => item.value === fuelType) ?? FUEL_TYPES[2];

const makeOption = (overrides = {}) => ({
  name: "",
  rental_per_day: 0,
  fuel_type: "petrol",
  consumption_per_100: 0,
  fuel_unit_price: 0,
  extra_fixed_cost: 0,
  km_limit_per_day: null,
  over_km_fee: 0,
  ...overrides,
});

const makeSharedCost = (overrides = {}) => ({
  name: "",
  amount: 0,
  ...overrides,
});

const DEFAULT_SHARED_COSTS = [
  makeSharedCost({ name: "Gửi xe" }),
  makeSharedCost({ name: "Trạm thu phí" }),
];

const DEFAULT_TRIP = {
  name: "",
  date: "",
  days: 2,
  distance_km: 0,
  people_count: 0,
  note: "",
  party_bill_id: "",
  selected_sort_order: "",
};

const DEFAULT_OPTIONS = [
  makeOption({
    name: "Xe xăng",
    rental_per_day: 500000,
    fuel_type: "petrol",
    consumption_per_100: 7,
    fuel_unit_price: FALLBACK_PETROL_PRICE,
  }),
  makeOption({
    name: "Xe điện",
    rental_per_day: 690000,
    fuel_type: "electric",
    consumption_per_100: 0,
    fuel_unit_price: 0,
  }),
];

/** Câu mô tả điểm hòa vốn, kèm cảnh báo khi có bật giới hạn km. */
function breakEvenText(result, distanceKm, hasKmLimit) {
  if (result.options.length !== 2) {
    return "Điểm hòa vốn chỉ tính được khi so đúng 2 phương án.";
  }

  const cheapest = result.options.find((option) => option.is_cheapest);
  const cheapestName = cheapest?.name || "Phương án rẻ nhất";
  const note = hasKmLimit ? " (chưa tính phí vượt km)" : "";

  if (result.break_even_km === null) {
    return `${cheapestName} rẻ hơn ở mọi quãng đường${note}.`;
  }

  const side = distanceKm >= result.break_even_km ? "trên" : "dưới";

  return `Đi ${side} ${formatNumber(result.break_even_km)} km thì ${cheapestName} rẻ hơn${note}.`;
}

function buildCopyText(trip, result, hasKmLimit) {
  const lines = [];
  const isAttached = trip.party_bill_id !== "";

  lines.push(`🚗 ${trip.name || "So sánh chi phí thuê xe"}`);
  lines.push(
    `Chuyến ${trip.days} ngày · ${formatNumber(trip.distance_km)} km (cả đi lẫn về)`,
  );
  lines.push("");

  result.options.forEach((option) => {
    lines.push(
      `${option.is_cheapest ? "✅" : "▫️"} ${option.name || "(chưa đặt tên)"}: ${formatCurrency(option.total_cost)}`,
    );

    const parts = [
      `Thuê ${formatCurrency(option.rental_cost)}`,
      `Nhiên liệu ${formatCurrency(option.fuel_cost)}`,
    ];
    if (option.over_km_cost > 0)
      parts.push(`Vượt km ${formatCurrency(option.over_km_cost)}`);
    if (option.extra_fixed_cost > 0)
      parts.push(`Khác ${formatCurrency(option.extra_fixed_cost)}`);
    lines.push(`   ${parts.join(" · ")}`);

    const perKm = `${formatCurrency(option.cost_per_km)}/km`;
    lines.push(
      trip.people_count > 0 && !isAttached
        ? `   ${perKm} · ${formatCurrency(option.per_person_cost)}/người`
        : `   ${perKm}`,
    );
  });

  lines.push("");
  if (result.saving_amount > 0) {
    lines.push(`👉 Tiết kiệm ${formatCurrency(result.saving_amount)}`);
  }
  lines.push(breakEvenText(result, trip.distance_km, hasKmLimit));

  if (isAttached) {
    lines.push("");
    lines.push("Tiền xe được chia qua bill tiệc.");
  }

  if (result.total_shared_cost > 0) {
    lines.push("");
    lines.push(`Chi phí chung: ${formatCurrency(result.total_shared_cost)}`);
    result.shared_costs.forEach((row) => {
      lines.push(`   ${row.name}: ${formatCurrency(row.amount)}`);
    });
    lines.push("");
    lines.push("TỔNG CHI PHÍ CHUYẾN ĐI");
    result.options.forEach((option) => {
      const perPerson =
        trip.people_count > 0 && !isAttached
          ? ` · ${formatCurrency(option.per_person_cost)}/người`
          : "";
      lines.push(
        `${option.is_cheapest ? "✅" : "▫️"} ${option.name}: ${formatCurrency(option.trip_total_cost)}${perPerson}`,
      );
    });
  }

  return lines.join("\n");
}

/** Số ngày kể từ một mốc ISO, làm tròn xuống. */
function daysSince(iso) {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.floor(ms / 86400000);
}

/**
 * Dòng xuất xứ giá xăng dưới ô đơn giá.
 *
 * Luôn nói rõ giá ở đâu ra và cũ bao lâu. Giá cào được CHỈ là gợi ý: người
 * dùng bấm "Dùng giá này" mới áp, và gõ đè bất cứ lúc nào.
 */
function MarketPriceHint({ marketPrice, applied, onApply }) {
  const {
    price,
    sources,
    source_date,
    fetched_at,
    last_error,
    is_manual,
    is_stale,
  } = marketPrice;

  const origin = is_manual
    ? "quản trị viên nhập tay"
    : Object.keys(sources ?? {}).join(" + ") || "không rõ nguồn";

  const when = source_date
    ? new Date(source_date).toLocaleDateString("vi-VN")
    : fetched_at
      ? new Date(fetched_at).toLocaleDateString("vi-VN")
      : null;

  const age = daysSince(fetched_at);

  return (
    <div
      className={`mt-1 text-xs ${is_stale ? "text-amber-700" : "text-gray-500"}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span>
          Giá thị trường {formatNumber(price)} đ/lít · {origin}
          {when && ` · ${when}`}
        </span>
        {!applied && (
          <button
            type="button"
            onClick={onApply}
            className="text-blue-600 hover:underline font-medium"
          >
            Dùng giá này
          </button>
        )}
        {applied && <span className="text-green-700">đang dùng</span>}
      </div>

      {is_stale && (
        <div>
          Giá đã cũ{age !== null ? ` ${age} ngày` : ""}, nên kiểm tra lại (giá
          điều chỉnh mỗi thứ Năm).
        </div>
      )}

      {last_error && <div>Lần cập nhật gần nhất thất bại: {last_error}</div>}
    </div>
  );
}

export default function CarRentalCalculator({
  editing,
  onSaved,
  onCancelEdit,
}) {
  const { hasPermission } = useAuth();
  const [trip, setTrip] = useState(DEFAULT_TRIP);
  const [options, setOptions] = useState(DEFAULT_OPTIONS);
  const [sharedCosts, setSharedCosts] = useState(DEFAULT_SHARED_COSTS);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [marketPrice, setMarketPrice] = useState(null);
  const [partyBills, setPartyBills] = useState([]);

  // Lấy giá xăng thị trường: chạy nền, KHÔNG chặn form. Lỗi thì im lặng bỏ
  // qua và giữ nguyên giá mặc định cứng.
  useEffect(() => {
    let cancelled = false;

    fuelPricesApi
      .getAll()
      .then((response) => {
        if (cancelled) return;
        const found = (response.data ?? []).find(
          (row) => row.fuel_key === PETROL_FUEL_KEY,
        );
        if (found) setMarketPrice(found);
      })
      .catch(() => {
        /* không có giá thị trường thì dùng mặc định cứng */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Nạp danh sách bill tiệc để gắn chuyến đi vào: chạy nền, lỗi thì bỏ qua,
  // không chặn form.
  useEffect(() => {
    let cancelled = false;

    partyBillsApi
      .getAll()
      .then((response) => {
        if (!cancelled) setPartyBills(response.data ?? []);
      })
      .catch(() => {
        /* không nạp được thì ẩn ô chọn, không chặn form */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Điền sẵn giá thị trường cho form MỚI. Không đụng vào form đang sửa bản
  // ghi cũ, và không ghi đè giá người dùng đã tự gõ.
  useEffect(() => {
    if (!marketPrice || editing) return;

    setOptions((prev) =>
      prev.map((option) =>
        option.fuel_type === "petrol" &&
        option.fuel_unit_price === FALLBACK_PETROL_PRICE
          ? { ...option, fuel_unit_price: marketPrice.price }
          : option,
      ),
    );
  }, [marketPrice, editing]);

  // Nạp lại một bản ghi cũ từ tab Lịch sử vào form.
  useEffect(() => {
    if (!editing) return;

    setTrip({
      name: editing.name ?? "",
      date: editing.date ? String(editing.date).slice(0, 10) : "",
      days: editing.days ?? 1,
      distance_km: editing.distance_km ?? 0,
      people_count: editing.people_count ?? 0,
      note: editing.note ?? "",
      party_bill_id: editing.party_bill_id ?? "",
      selected_sort_order:
        editing.selected_sort_order === null ||
        editing.selected_sort_order === undefined
          ? ""
          : editing.selected_sort_order,
    });

    setOptions(
      (editing.options ?? []).map((option) =>
        makeOption({
          name: option.name,
          rental_per_day: option.rental_per_day,
          fuel_type: option.fuel_type,
          consumption_per_100: Number(option.consumption_per_100),
          fuel_unit_price: option.fuel_unit_price,
          extra_fixed_cost: option.extra_fixed_cost,
          km_limit_per_day: option.km_limit_per_day,
          over_km_fee: option.over_km_fee,
        }),
      ),
    );

    setSharedCosts(
      (editing.shared_costs ?? []).map((row) =>
        makeSharedCost({ name: row.name, amount: row.amount }),
      ),
    );

    setShowAdvanced(
      (editing.options ?? []).some(
        (option) =>
          option.km_limit_per_day !== null || option.extra_fixed_cost > 0,
      ),
    );
  }, [editing]);

  const result = useMemo(
    () =>
      calculateCarRental({
        days: trip.days,
        distance_km: trip.distance_km,
        people_count: trip.people_count,
        options: options.map((option, index) => ({
          ...option,
          sort_order: index,
        })),
        shared_costs: sharedCosts,
      }),
    [trip, options, sharedCosts],
  );

  const hasKmLimit = options.some((option) => option.km_limit_per_day !== null);

  // Nguồn sự thật cho "đã gắn bill" là party_bill_id, KHÔNG phải việc tra
  // được tên bill hay chưa — danh sách partyBills có thể tải lỗi/chưa xong.
  const isAttached = trip.party_bill_id !== "";
  const linkedBill = partyBills.find(
    (bill) => String(bill.id) === String(trip.party_bill_id),
  );

  const setTripField = (field) => (event) => {
    const raw = event.target.value;
    const numeric = ["days", "distance_km", "people_count"].includes(field);
    setTrip((prev) => ({ ...prev, [field]: numeric ? Number(raw) || 0 : raw }));
  };

  const setOptionField = (index, field, value) => {
    setOptions((prev) =>
      prev.map((option, i) =>
        i === index ? { ...option, [field]: value } : option,
      ),
    );
  };

  const addOption = () =>
    setOptions((prev) => [
      ...prev,
      makeOption({ name: `Phương án ${prev.length + 1}` }),
    ]);

  // Bỏ phương án làm dịch chỉ số các phương án phía sau. Nếu "Xe thực tế
  // thuê" đang trỏ vào phương án bị xóa hoặc vào một vị trí bị dịch chuyển,
  // KHÔNG giữ nguyên số cũ (dễ trỏ nhầm xe) — về lại "Phương án rẻ nhất".
  const removeOption = (index) => {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
    setTrip((prev) =>
      prev.selected_sort_order !== "" &&
      Number(prev.selected_sort_order) >= index
        ? { ...prev, selected_sort_order: "" }
        : prev,
    );
  };

  const setSharedCostField = (index, field, value) => {
    setSharedCosts((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  };

  const addSharedCost = () =>
    setSharedCosts((prev) => [...prev, makeSharedCost()]);

  const removeSharedCost = (index) =>
    setSharedCosts((prev) => prev.filter((_, i) => i !== index));

  const resetForm = () => {
    setTrip(DEFAULT_TRIP);
    setOptions(DEFAULT_OPTIONS);
    setSharedCosts(DEFAULT_SHARED_COSTS);
    setShowAdvanced(false);
    onCancelEdit?.();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        buildCopyText(trip, result, hasKmLimit),
      );
      setMessage({ type: "success", text: "Đã copy kết quả." });
    } catch {
      setMessage({
        type: "error",
        text: "Trình duyệt không cho copy. Hãy bôi đen và copy tay.",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const payload = {
      name: trip.name || null,
      date: trip.date || null,
      days: trip.days,
      distance_km: trip.distance_km,
      people_count: trip.people_count,
      note: trip.note || null,
      party_bill_id:
        trip.party_bill_id === "" ? null : Number(trip.party_bill_id),
      selected_sort_order:
        trip.selected_sort_order === ""
          ? null
          : Number(trip.selected_sort_order),
      options: options.map((option, index) => ({
        name: option.name || `Phương án ${index + 1}`,
        sort_order: index,
        rental_per_day: option.rental_per_day,
        fuel_type: option.fuel_type,
        consumption_per_100: option.consumption_per_100,
        fuel_unit_price: option.fuel_unit_price,
        extra_fixed_cost: option.extra_fixed_cost,
        km_limit_per_day: option.km_limit_per_day,
        over_km_fee: option.over_km_fee,
      })),
      shared_costs: sharedCosts
        .filter((row) => row.name.trim() !== "")
        .map((row) => ({ name: row.name.trim(), amount: row.amount })),
    };

    try {
      if (editing) {
        await carRentalsApi.update(editing.id, payload);
      } else {
        await carRentalsApi.create(payload);
      }
      resetForm();
      onSaved?.();
    } catch (error) {
      const data = error?.response?.data;
      const detail =
        data?.errors?.party_bill_id?.[0] ||
        data?.message ||
        "Không lưu được. Thử lại giúp mình.";
      setMessage({ type: "error", text: detail });
    } finally {
      setSaving(false);
    }
  };

  const canSave = editing
    ? hasPermission("car_rentals.update")
    : hasPermission("car_rentals.create");

  const inputClass =
    "w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500";
  const labelClass = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`px-4 py-3 rounded-lg ${
            message.type === "error"
              ? "bg-red-50 text-red-700 border border-red-200"
              : "bg-green-50 text-green-700 border border-green-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {editing && (
        <div className="px-4 py-3 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 flex items-center justify-between gap-3">
          <span>Đang sửa bản ghi đã lưu trước đó.</span>
          <button
            type="button"
            onClick={resetForm}
            className="underline font-medium"
          >
            Hủy sửa
          </button>
        </div>
      )}

      {/* Thông tin chuyến đi */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Chuyến đi</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Tên chuyến</label>
            <input
              type="text"
              className={inputClass}
              placeholder="Chuyến Đà Lạt"
              value={trip.name}
              onChange={setTripField("name")}
            />
          </div>
          <div>
            <label className={labelClass}>Ngày đi</label>
            <input
              type="date"
              className={inputClass}
              value={trip.date}
              onChange={setTripField("date")}
            />
          </div>
          <div>
            <label className={labelClass}>Số ngày thuê</label>
            <input
              type="number"
              min="1"
              className={inputClass}
              value={trip.days}
              onChange={setTripField("days")}
            />
          </div>
          <div>
            <label className={labelClass}>Tổng km (cả đi lẫn về)</label>
            <input
              type="number"
              min="0"
              className={inputClass}
              value={trip.distance_km}
              onChange={setTripField("distance_km")}
            />
          </div>
          <div>
            <label className={labelClass}>Số người đi (0 = không chia)</label>
            <input
              type="number"
              min="0"
              className={inputClass}
              value={trip.people_count}
              onChange={setTripField("people_count")}
            />
          </div>
          <div className="sm:col-span-2 lg:col-span-1">
            <label className={labelClass}>Ghi chú</label>
            <input
              type="text"
              className={inputClass}
              value={trip.note}
              onChange={setTripField("note")}
            />
          </div>

          <div>
            <label className={labelClass}>Gắn vào bill tiệc</label>
            <select
              className={inputClass}
              value={trip.party_bill_id}
              onChange={(event) => {
                const value = event.target.value;
                setTrip((prev) => ({
                  ...prev,
                  party_bill_id: value,
                  // Bỏ gắn thì xóa luôn lựa chọn "xe thực tế thuê" cũ — không
                  // để nó âm thầm theo qua lần gắn bill khác.
                  selected_sort_order:
                    value === "" ? "" : prev.selected_sort_order,
                }));
              }}
            >
              <option value="">— Không gắn —</option>
              {partyBills.map((bill) => (
                <option key={bill.id} value={bill.id}>
                  {bill.name || `Bill #${bill.id}`}
                  {bill.date
                    ? ` · ${new Date(bill.date).toLocaleDateString("vi-VN")}`
                    : ""}
                </option>
              ))}
            </select>
            {partyBills.length === 0 && !isAttached && (
              <p className="mt-1 text-xs text-gray-500">
                Chưa có bill tiệc nào để gắn vào.
              </p>
            )}
          </div>

          {isAttached && (
            <div>
              <label className={labelClass}>Xe thực tế thuê</label>
              <select
                className={inputClass}
                value={trip.selected_sort_order}
                onChange={(event) =>
                  setTrip((prev) => ({
                    ...prev,
                    selected_sort_order: event.target.value,
                  }))
                }
              >
                <option value="">Phương án rẻ nhất</option>
                {options.map((option, index) => (
                  <option key={index} value={index}>
                    {option.name || `Phương án ${index + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* Các phương án */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">Phương án thuê xe</h2>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showAdvanced}
              onChange={(event) => setShowAdvanced(event.target.checked)}
            />
            Nâng cao
          </label>
        </div>

        <div className="space-y-4">
          {options.map((option, index) => {
            const meta = fuelMeta(option.fuel_type);

            return (
              <div
                key={index}
                className="border border-slate-200 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <input
                    type="text"
                    className="font-medium text-gray-900 border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-500 bg-transparent"
                    placeholder={`Phương án ${index + 1}`}
                    value={option.name}
                    onChange={(event) =>
                      setOptionField(index, "name", event.target.value)
                    }
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(index)}
                      className="text-red-600 text-sm hover:underline"
                    >
                      Xóa
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className={labelClass}>Giá thuê / ngày (đ)</label>
                    <CurrencyInput
                      baseClassName={inputClass}
                      value={option.rental_per_day}
                      onChange={(value) =>
                        setOptionField(index, "rental_per_day", value)
                      }
                    />
                    <ThousandHint
                      value={option.rental_per_day}
                      onApply={(value) =>
                        setOptionField(index, "rental_per_day", value)
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Nhiên liệu</label>
                    <select
                      className={inputClass}
                      value={option.fuel_type}
                      onChange={(event) =>
                        setOptionField(index, "fuel_type", event.target.value)
                      }
                    >
                      {FUEL_TYPES.map((item) => (
                        <option key={item.value} value={item.value}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {option.fuel_type !== "none" && (
                    <>
                      <div>
                        <label className={labelClass}>
                          Tiêu hao ({meta.unit})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          className={inputClass}
                          value={option.consumption_per_100}
                          onChange={(event) =>
                            setOptionField(
                              index,
                              "consumption_per_100",
                              Number(event.target.value) || 0,
                            )
                          }
                        />
                      </div>
                      <div>
                        <label className={labelClass}>
                          Đơn giá ({meta.priceUnit}) — 0 là miễn phí
                        </label>
                        <CurrencyInput
                          baseClassName={inputClass}
                          value={option.fuel_unit_price}
                          onChange={(value) =>
                            setOptionField(index, "fuel_unit_price", value)
                          }
                        />
                        <ThousandHint
                          value={option.fuel_unit_price}
                          onApply={(value) =>
                            setOptionField(index, "fuel_unit_price", value)
                          }
                        />
                        {option.fuel_type === "petrol" && marketPrice && (
                          <MarketPriceHint
                            marketPrice={marketPrice}
                            applied={
                              option.fuel_unit_price === marketPrice.price
                            }
                            onApply={() =>
                              setOptionField(
                                index,
                                "fuel_unit_price",
                                marketPrice.price,
                              )
                            }
                          />
                        )}
                      </div>
                    </>
                  )}
                </div>

                {showAdvanced && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3 pt-3 border-t border-dashed border-slate-200">
                    <div>
                      <label className={labelClass}>
                        Chi phí cố định khác (đ)
                      </label>
                      <CurrencyInput
                        baseClassName={inputClass}
                        value={option.extra_fixed_cost}
                        onChange={(value) =>
                          setOptionField(index, "extra_fixed_cost", value)
                        }
                      />
                      <ThousandHint
                        value={option.extra_fixed_cost}
                        onApply={(value) =>
                          setOptionField(index, "extra_fixed_cost", value)
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>
                        Giới hạn km/ngày (trống = không giới hạn)
                      </label>
                      <input
                        type="number"
                        min="1"
                        className={inputClass}
                        value={option.km_limit_per_day ?? ""}
                        onChange={(event) =>
                          setOptionField(
                            index,
                            "km_limit_per_day",
                            event.target.value === ""
                              ? null
                              : Number(event.target.value),
                          )
                        }
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Phí vượt (đ/km)</label>
                      <CurrencyInput
                        baseClassName={inputClass}
                        value={option.over_km_fee}
                        onChange={(value) =>
                          setOptionField(index, "over_km_fee", value)
                        }
                      />
                      <ThousandHint
                        value={option.over_km_fee}
                        onApply={(value) =>
                          setOptionField(index, "over_km_fee", value)
                        }
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={addOption}
          className="mt-4 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600"
        >
          + Thêm phương án
        </button>
      </section>

      {/* Chi phí chung cả chuyến */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <div className="mb-1 flex items-baseline justify-between gap-3">
          <h2 className="font-semibold text-gray-900">
            Chi phí chung cả chuyến
          </h2>
          <span className="text-sm text-gray-500">
            Tổng {formatCurrency(result.total_shared_cost)}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Các khoản áp như nhau cho mọi phương án, không ảnh hưởng việc so sánh
          xe.
        </p>

        <div className="space-y-2">
          {sharedCosts.map((row, index) => (
            // Lưới 3 cột thay vì flex-wrap: mỗi khoản chi luôn nằm gọn một
            // dòng, kể cả trên điện thoại. Cột tên co giãn, cột tiền cố định.
            <div
              key={index}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-start gap-2"
            >
              <input
                type="text"
                className={inputClass}
                placeholder="Tên khoản chi"
                value={row.name}
                onChange={(event) =>
                  setSharedCostField(index, "name", event.target.value)
                }
              />
              <div className="w-28 sm:w-40">
                <CurrencyInput
                  baseClassName={inputClass}
                  value={row.amount}
                  onChange={(value) =>
                    setSharedCostField(index, "amount", value)
                  }
                />
                <ThousandHint
                  value={row.amount}
                  onApply={(value) =>
                    setSharedCostField(index, "amount", value)
                  }
                />
              </div>
              <button
                type="button"
                onClick={() => removeSharedCost(index)}
                aria-label={`Xóa khoản chi ${row.name || index + 1}`}
                className="px-2 py-2 text-red-600 text-sm hover:underline sm:px-3"
              >
                <span aria-hidden="true" className="sm:hidden">
                  ✕
                </span>
                <span className="hidden sm:inline">Xóa</span>
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={addSharedCost}
          className="mt-3 px-4 py-2 border border-dashed border-slate-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600"
        >
          + Thêm khoản chi
        </button>
      </section>

      {/* Kết quả */}
      <section className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Kết quả</h2>

        <div className="overflow-x-auto">
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
              {result.options.map((option, index) => (
                <tr
                  key={index}
                  className={`border-b border-slate-100 ${option.is_cheapest ? "bg-green-50" : ""}`}
                >
                  <td className="py-2 pr-3 font-medium text-gray-900">
                    {option.name || `Phương án ${index + 1}`}
                    {option.is_cheapest && (
                      <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-green-600 text-white">
                        Rẻ nhất
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {formatCurrency(option.rental_cost)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {formatCurrency(option.fuel_cost)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {formatCurrency(option.over_km_cost)}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {formatCurrency(option.extra_fixed_cost)}
                  </td>
                  <td className="py-2 px-3 text-right font-semibold text-gray-900">
                    {formatCurrency(option.total_cost)}
                  </td>
                  <td className="py-2 pl-3 text-right">
                    {formatCurrency(option.cost_per_km)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 space-y-2">
          {result.saving_amount > 0 && (
            <div className="text-green-700 font-medium">
              Tiết kiệm {formatCurrency(result.saving_amount)}
              {result.options.length === 2 &&
                (() => {
                  const totals = result.options
                    .map((option) => option.total_cost)
                    .sort((a, b) => b - a);
                  return totals[0] > 0
                    ? ` (−${Math.round((result.saving_amount / totals[0]) * 1000) / 10}%)`
                    : "";
                })()}
            </div>
          )}
          <div className="text-gray-700">
            {breakEvenText(result, trip.distance_km, hasKmLimit)}
          </div>
        </div>

        {(result.total_shared_cost > 0 ||
          trip.people_count > 0 ||
          isAttached) && (
          <div className="mt-5 pt-4 border-t border-slate-200">
            <h3 className="font-semibold text-gray-900 mb-2">
              Tổng chi phí chuyến đi
            </h3>

            {result.total_shared_cost > 0 && (
              <div className="text-sm text-gray-600 mb-3 space-y-0.5">
                {result.shared_costs.map((row) => (
                  <div
                    key={row.sort_order}
                    className="flex justify-between max-w-xs"
                  >
                    <span>{row.name}</span>
                    <span>{formatCurrency(row.amount)}</span>
                  </div>
                ))}
                <div className="flex justify-between max-w-xs font-medium text-gray-900 pt-1 border-t border-slate-200">
                  <span>Chi phí chung</span>
                  <span>{formatCurrency(result.total_shared_cost)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1">
              {result.options.map((option, index) => (
                <div
                  key={index}
                  className={`flex flex-wrap items-baseline justify-between gap-2 px-3 py-2 rounded-lg ${
                    option.is_cheapest ? "bg-green-50" : ""
                  }`}
                >
                  <span className="font-medium text-gray-900">
                    {option.name || `Phương án ${index + 1}`}
                    {option.is_cheapest && " 🏆"}
                  </span>
                  <span className="text-gray-900">
                    <span className="font-semibold">
                      {formatCurrency(option.trip_total_cost)}
                    </span>
                    {trip.people_count > 0 && !isAttached && (
                      <span className="text-gray-600">
                        {" · "}
                        {formatCurrency(option.per_person_cost)}/người
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {isAttached ? (
              <div className="mt-3 text-sm text-blue-700 bg-blue-50 rounded-lg px-3 py-2">
                Tiền xe được chia qua bill tiệc{" "}
                <Link
                  to={`/party-bills/${trip.party_bill_id}`}
                  className="font-medium underline"
                >
                  {linkedBill
                    ? linkedBill.name || `Bill #${linkedBill.id}`
                    : "Bill tiệc đã gắn (chưa tải được tên)"}
                </Link>
                {result.total_shared_cost > 0 && (
                  <div className="text-blue-600 mt-1">
                    Số đẩy sang đã gồm chi phí chung (
                    {formatCurrency(result.total_shared_cost)}) — đừng gõ lại
                    gửi xe / trạm thu phí thành dòng riêng bên bill tiệc.
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 border border-slate-300 rounded-lg text-gray-700 hover:bg-slate-50"
          >
            Copy kết quả
          </button>
          {canSave && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : editing ? "Cập nhật" : "Lưu lại"}
            </button>
          )}
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 text-gray-600 hover:text-gray-900"
          >
            Nhập lại
          </button>
        </div>
      </section>
    </div>
  );
}
