import { describe, expect, it } from "vitest";
import { BALLS_PER_TUBE, LOW_STOCK_BALLS, stockLevel } from "./shuttleStock";

describe("shuttleStock", () => {
  it("1 ống = 12 quả, ngưỡng sắp hết = 10 ống", () => {
    expect(BALLS_PER_TUBE).toBe(12);
    expect(LOW_STOCK_BALLS).toBe(120);
  });

  it("hết cầu khi tồn ≤ 0, kể cả số âm (bill trừ kho không chặn)", () => {
    expect(stockLevel(0)).toBe("out");
    expect(stockLevel(-6)).toBe("out");
  });

  it("sắp hết khi còn dưới 10 ống", () => {
    expect(stockLevel(1)).toBe("low");
    expect(stockLevel(119)).toBe("low");
  });

  it("đủ khi từ 10 ống trở lên", () => {
    expect(stockLevel(120)).toBe("ok");
    expect(stockLevel(214)).toBe("ok");
  });

  it("thiếu số / chuỗi số từ API: coi như số", () => {
    expect(stockLevel(null)).toBe("out");
    expect(stockLevel(undefined)).toBe("out");
    expect(stockLevel("96")).toBe("low");
  });
});
