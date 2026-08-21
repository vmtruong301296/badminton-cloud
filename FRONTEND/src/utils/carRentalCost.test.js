import { describe, expect, it } from "vitest";
import { calculateCarRental } from "./carRentalCost";

const petrol = (overrides = {}) => ({
  name: "Xe xăng",
  sort_order: 0,
  rental_per_day: 500000,
  fuel_type: "petrol",
  consumption_per_100: 7,
  fuel_unit_price: 30000,
  extra_fixed_cost: 0,
  km_limit_per_day: null,
  over_km_fee: 0,
  ...overrides,
});

const electric = (overrides = {}) => ({
  name: "Xe điện",
  sort_order: 1,
  rental_per_day: 690000,
  fuel_type: "electric",
  consumption_per_100: 0,
  fuel_unit_price: 0,
  extra_fixed_cost: 0,
  km_limit_per_day: null,
  over_km_fee: 0,
  ...overrides,
});

const trip = (options, overrides = {}) => ({
  days: 2,
  distance_km: 800,
  people_count: 0,
  options,
  ...overrides,
});

describe("calculateCarRental", () => {
  it("khớp bài toán mẫu 800km 2 ngày", () => {
    const result = calculateCarRental(trip([petrol(), electric()]));
    const [xang, dien] = result.options;

    expect(xang.rental_cost).toBe(1000000);
    expect(xang.fuel_cost).toBe(1680000);
    expect(xang.over_km_cost).toBe(0);
    expect(xang.total_cost).toBe(2680000);
    expect(xang.cost_per_km).toBe(3350);
    expect(xang.is_cheapest).toBe(false);

    expect(dien.total_cost).toBe(1380000);
    expect(dien.cost_per_km).toBe(1725);
    expect(dien.is_cheapest).toBe(true);

    expect(result.saving_amount).toBe(1300000);
    expect(result.break_even_km).toBe(181);
  });

  it("tính đúng khi xe điện sạc trả phí", () => {
    const result = calculateCarRental(
      trip([petrol(), electric({ consumption_per_100: 18, fuel_unit_price: 3858 })])
    );

    expect(result.options[1].fuel_cost).toBe(555552);
    expect(result.options[1].total_cost).toBe(1935552);
    expect(result.saving_amount).toBe(744448);
  });

  it("cộng phí vượt giới hạn km cho cả hai phương án", () => {
    const result = calculateCarRental(
      trip([
        petrol({ km_limit_per_day: 300, over_km_fee: 4000 }),
        electric({ km_limit_per_day: 300, over_km_fee: 4000 }),
      ])
    );

    expect(result.options[0].over_km_cost).toBe(800000);
    expect(result.options[1].over_km_cost).toBe(800000);
    expect(result.options[0].total_cost).toBe(3480000);
    expect(result.options[1].total_cost).toBe(2180000);
  });

  it("không tính vượt khi giới hạn đủ lớn", () => {
    const result = calculateCarRental(
      trip([petrol({ km_limit_per_day: 500, over_km_fee: 4000 }), electric()])
    );

    expect(result.options[0].over_km_cost).toBe(0);
  });

  it("cộng chi phí cố định khác vào tổng", () => {
    const result = calculateCarRental(
      trip([petrol({ extra_fixed_cost: 200000 }), electric()])
    );

    expect(result.options[0].total_cost).toBe(2880000);
  });

  it("bỏ qua tiêu hao khi fuel_type là none", () => {
    const result = calculateCarRental(trip([petrol({ fuel_type: "none" }), electric()]));

    expect(result.options[0].fuel_cost).toBe(0);
    expect(result.options[0].total_cost).toBe(1000000);
  });

  it("không chia cho 0 khi quãng đường bằng 0", () => {
    const result = calculateCarRental(trip([petrol(), electric()], { distance_km: 0 }));

    expect(result.options[0].cost_per_km).toBe(0);
    expect(result.options[0].fuel_cost).toBe(0);
  });

  it("chia đầu người", () => {
    const result = calculateCarRental(trip([petrol(), electric()], { people_count: 8 }));

    expect(result.options[0].per_person_cost).toBe(335000);
    expect(result.options[1].per_person_cost).toBe(172500);
  });

  it("không chia cho 0 khi số người bằng 0", () => {
    const result = calculateCarRental(trip([petrol(), electric()]));

    expect(result.options[0].per_person_cost).toBe(0);
  });

  it("không có điểm hòa vốn khi có 3 phương án", () => {
    const result = calculateCarRental(
      trip([
        petrol(),
        electric(),
        petrol({ name: "Xe xăng nhà B", sort_order: 2, rental_per_day: 450000 }),
      ])
    );

    expect(result.break_even_km).toBeNull();
    expect(result.options[1].is_cheapest).toBe(true);
  });

  it("không có nghiệm khi hai phương án cùng mức tiêu hao", () => {
    const result = calculateCarRental(
      trip([petrol(), petrol({ name: "Xe xăng nhà B", sort_order: 1, rental_per_day: 450000 })])
    );

    expect(result.break_even_km).toBeNull();
    expect(result.options[1].is_cheapest).toBe(true);
  });

  it("trả null khi điểm cắt âm", () => {
    const result = calculateCarRental(
      trip([petrol(), electric({ rental_per_day: 400000 })])
    );

    expect(result.break_even_km).toBeNull();
  });

  it("hòa tổng tiền thì sort_order nhỏ hơn thắng", () => {
    const result = calculateCarRental(
      trip([
        electric({ name: "Điện A", sort_order: 0 }),
        electric({ name: "Điện B", sort_order: 1 }),
      ])
    );

    expect(result.options[0].is_cheapest).toBe(true);
    expect(result.options[1].is_cheapest).toBe(false);
    expect(result.saving_amount).toBe(0);
  });

  // ----- Chi phí chung cả chuyến -----

  it("không có chi phí chung thì trip_total bằng total", () => {
    const result = calculateCarRental(trip([petrol(), electric()]));

    expect(result.total_shared_cost).toBe(0);
    expect(result.shared_costs).toEqual([]);
    expect(result.options[0].trip_total_cost).toBe(2680000);
    expect(result.options[1].trip_total_cost).toBe(1380000);
  });

  it("chi phí chung cộng vào cả hai phương án", () => {
    const result = calculateCarRental(
      trip([petrol(), electric()], {
        shared_costs: [
          { name: "Gửi xe", amount: 200000 },
          { name: "Trạm thu phí", amount: 300000 },
        ],
      })
    );

    expect(result.total_shared_cost).toBe(500000);
    expect(result.shared_costs).toHaveLength(2);
    expect(result.shared_costs[0].sort_order).toBe(0);
    expect(result.shared_costs[1].sort_order).toBe(1);

    expect(result.options[0].total_cost).toBe(2680000);
    expect(result.options[0].trip_total_cost).toBe(3180000);
    expect(result.options[1].trip_total_cost).toBe(1880000);
  });

  it("chi phí chung không đổi phương án rẻ nhất và điểm hòa vốn", () => {
    const result = calculateCarRental(
      trip([petrol(), electric()], {
        shared_costs: [{ name: "Gửi xe", amount: 5000000 }],
      })
    );

    expect(result.options[1].is_cheapest).toBe(true);
    expect(result.saving_amount).toBe(1300000);
    expect(result.break_even_km).toBe(181);
  });

  it("chia đầu người tính trên tổng chuyến", () => {
    const result = calculateCarRental(
      trip([petrol(), electric()], {
        people_count: 8,
        shared_costs: [{ name: "Trạm thu phí", amount: 400000 }],
      })
    );

    expect(result.options[0].per_person_cost).toBe(385000);
    expect(result.options[1].per_person_cost).toBe(222500);
  });

  it("bỏ qua dòng chi phí chung không có tên", () => {
    const result = calculateCarRental(
      trip([petrol(), electric()], {
        shared_costs: [
          { name: "Gửi xe", amount: 200000 },
          { name: "", amount: 999000 },
          { name: "   ", amount: 111000 },
        ],
      })
    );

    expect(result.shared_costs).toHaveLength(1);
    expect(result.total_shared_cost).toBe(200000);
  });
});
