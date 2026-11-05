import { describe, expect, it } from "vitest";
import {
  formatShuttleStock,
  formatTubes,
  stockTileParts,
} from "./shuttleStock";

describe("formatShuttleStock", () => {
  it("in quả kèm gợi ý ống (như khối Cầu khả dụng cũ)", () => {
    expect(formatShuttleStock(0)).toBe("0 quả");
    expect(formatShuttleStock(8)).toBe("8 quả");
    expect(formatShuttleStock(24)).toBe("2 ống (24 quả)");
    expect(formatShuttleStock(186)).toBe("15 ống + 6 quả (186 quả)");
    expect(formatShuttleStock(-5)).toBe("-5 quả");
  });
});

describe("formatTubes", () => {
  it("ống + quả lẻ, không ghi tổng quả", () => {
    expect(formatTubes(38)).toBe("3 ống + 2 quả");
    expect(formatTubes(36)).toBe("3 ống");
    expect(formatTubes(5)).toBe("5 quả");
    expect(formatTubes(0)).toBe("0 quả");
  });
});

describe("stockTileParts", () => {
  it("số chính là ống, dòng phụ là quả lẻ và tổng quả", () => {
    expect(stockTileParts(186)).toEqual({
      value: "15 ống",
      sub: "+ 6 quả (186 quả)",
    });
    expect(stockTileParts(180)).toEqual({ value: "15 ống", sub: "180 quả" });
    expect(stockTileParts(8)).toEqual({ value: "8 quả", sub: "" });
    expect(stockTileParts(1940)).toEqual({
      value: "161 ống",
      sub: "+ 8 quả (1.940 quả)",
    });
  });
});
