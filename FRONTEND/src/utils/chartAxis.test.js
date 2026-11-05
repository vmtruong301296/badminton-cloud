import { describe, expect, it } from "vitest";
import { niceAxisMax } from "./chartAxis";

describe("niceAxisMax", () => {
  it("số tròn vừa trên giá trị lớn nhất để cột cao nhất chiếm hơn nửa khung", () => {
    expect(niceAxisMax(216)).toBe(300);
    expect(niceAxisMax(14)).toBe(20);
    expect(niceAxisMax(38)).toBe(40);
    expect(niceAxisMax(1941)).toBe(2000);
  });

  it("vạch giữa luôn là số nguyên (không có vạch 0,5)", () => {
    [1, 3, 5, 7, 11, 15, 120, 151].forEach((value) => {
      const axis = niceAxisMax(value);
      expect(axis).toBeGreaterThanOrEqual(value);
      expect(Number.isInteger(axis / 2)).toBe(true);
      expect(value / axis).toBeGreaterThanOrEqual(value > 1 ? 0.5 : 0);
    });
  });

  it("không có số liệu thì trục 0–2", () => {
    expect(niceAxisMax(0)).toBe(2);
  });
});
