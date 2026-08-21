/**
 * Công thức tính chi phí thuê xe cho một chuyến đi.
 *
 * QUAN TRỌNG: file này là bản sao 1-1 của BACKEND/app/Services/CarRentalCalculator.php.
 * Sửa một bên thì phải sửa bên kia, và hai bộ test (carRentalCost.test.js +
 * CarRentalCalculatorTest.php) dùng chung một bộ số kỳ vọng để ghim việc đó.
 *
 * Tên trường cố ý dùng snake_case để khớp định dạng đi trên dây của API.
 */

/** Sai số cho phép khi so sánh hai chi phí biến đổi (đ/km) dạng số thực. */
const EPSILON = 0.000001;

const toInt = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.trunc(num) : 0;
};

const toFloat = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

function calculateOption(raw, index, days, distanceKm, peopleCount, totalSharedCost) {
  const fuelType = raw.fuel_type ?? "none";
  const rentalPerDay = toInt(raw.rental_per_day);
  const consumption = fuelType === "none" ? 0 : toFloat(raw.consumption_per_100);
  const fuelUnitPrice = toInt(raw.fuel_unit_price);
  const extraFixedCost = toInt(raw.extra_fixed_cost);
  const overKmFee = toInt(raw.over_km_fee);

  const kmLimitPerDay =
    raw.km_limit_per_day === null ||
    raw.km_limit_per_day === undefined ||
    raw.km_limit_per_day === ""
      ? null
      : toInt(raw.km_limit_per_day);

  const rentalCost = rentalPerDay * days;
  const fuelCost = Math.round(((distanceKm * consumption) / 100) * fuelUnitPrice);

  const overKm =
    kmLimitPerDay === null ? 0 : Math.max(0, distanceKm - kmLimitPerDay * days);
  const overKmCost = overKm * overKmFee;

  const totalCost = rentalCost + fuelCost + overKmCost + extraFixedCost;

  // Chi phí chung giống hệt nhau ở mọi phương án nên CỐ Ý không nằm trong
  // totalCost: giữ nguyên nghĩa "chi phí của riêng chiếc xe" cho phần so sánh
  // (đ/km, % tiết kiệm, is_cheapest, break_even_km).
  const tripTotalCost = totalCost + totalSharedCost;

  return {
    name: raw.name ?? "",
    sort_order:
      raw.sort_order === undefined || raw.sort_order === null
        ? index
        : toInt(raw.sort_order),
    rental_per_day: rentalPerDay,
    fuel_type: fuelType,
    consumption_per_100: consumption,
    fuel_unit_price: fuelUnitPrice,
    extra_fixed_cost: extraFixedCost,
    km_limit_per_day: kmLimitPerDay,
    over_km_fee: overKmFee,
    rental_cost: rentalCost,
    fuel_cost: fuelCost,
    over_km_cost: overKmCost,
    total_cost: totalCost,
    cost_per_km: distanceKm > 0 ? Math.round(totalCost / distanceKm) : 0,
    trip_total_cost: tripTotalCost,
    per_person_cost: peopleCount > 0 ? Math.round(tripTotalCost / peopleCount) : 0,
    is_cheapest: false,
  };
}

/**
 * Chuẩn hóa danh sách chi phí chung: bỏ dòng không có tên, đánh lại sort_order
 * theo thứ tự còn lại.
 */
function normalizeSharedCosts(rows) {
  const result = [];

  (rows ?? []).forEach((raw) => {
    const name = String(raw.name ?? "").trim();
    if (name === "") return;

    result.push({
      name,
      amount: toInt(raw.amount),
      sort_order: result.length,
    });
  });

  return result;
}

/** Đánh dấu phương án tổng tiền nhỏ nhất. Hòa thì sort_order nhỏ hơn thắng. */
function markCheapest(options) {
  if (options.length === 0) return options;

  let winner = 0;
  options.forEach((option, i) => {
    const best = options[winner];
    const cheaper = option.total_cost < best.total_cost;
    const tieButEarlier =
      option.total_cost === best.total_cost && option.sort_order < best.sort_order;

    if (cheaper || tieButEarlier) winner = i;
  });

  options[winner].is_cheapest = true;

  return options;
}

function savingAmount(options) {
  if (options.length < 2) return 0;

  const totals = options.map((o) => o.total_cost).sort((a, b) => a - b);

  return totals[1] - totals[0];
}

/**
 * Quãng đường mà hai phương án hòa chi phí.
 *
 * Chỉ tính khi có đúng 2 phương án và CỐ Ý bỏ qua phí vượt km, vì phí vượt là
 * hàm bậc thang làm bài toán mất tính tuyến tính. Màn hình phải ghi rõ
 * "(chưa tính phí vượt km)" khi người dùng có bật giới hạn km.
 */
function breakEvenKm(options, days) {
  if (options.length !== 2) return null;

  const [a, b] = options;

  const fixedA = a.rental_per_day * days + a.extra_fixed_cost;
  const fixedB = b.rental_per_day * days + b.extra_fixed_cost;
  const varA = (a.consumption_per_100 / 100) * a.fuel_unit_price;
  const varB = (b.consumption_per_100 / 100) * b.fuel_unit_price;

  if (Math.abs(varA - varB) < EPSILON) return null;

  const distance = (fixedB - fixedA) / (varA - varB);

  return distance > 0 ? Math.round(distance) : null;
}

export function calculateCarRental(input) {
  const days = toInt(input.days);
  const distanceKm = toInt(input.distance_km);
  const peopleCount = toInt(input.people_count);

  const sharedCosts = normalizeSharedCosts(input.shared_costs);
  const totalSharedCost = sharedCosts.reduce((sum, row) => sum + row.amount, 0);

  const options = markCheapest(
    (input.options ?? []).map((raw, index) =>
      calculateOption(raw, index, days, distanceKm, peopleCount, totalSharedCost)
    )
  );

  return {
    break_even_km: breakEvenKm(options, days),
    saving_amount: savingAmount(options),
    total_shared_cost: totalSharedCost,
    shared_costs: sharedCosts,
    options,
  };
}
