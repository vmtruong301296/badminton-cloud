import { describe, expect, it } from "vitest";
import { canStep, stepNumber } from "./numberStep";

describe("stepNumber", () => {
  it("cộng / trừ một bước", () => {
    expect(stepNumber(2, 1)).toBe(3);
    expect(stepNumber(2, -1)).toBe(1);
    expect(stepNumber(4, 1, { step: 2 })).toBe(6);
  });

  it("ô trống hoặc không phải số coi như 0 (hoặc min nếu có)", () => {
    expect(stepNumber("", 1)).toBe(1);
    expect(stepNumber(null, -1)).toBe(-1);
    expect(stepNumber(undefined, 1, { min: 1 })).toBe(2);
    expect(stepNumber("abc", 1, { min: 3 })).toBe(4);
  });

  it("không vượt min / max", () => {
    expect(stepNumber(1, -1, { min: 1 })).toBe(1);
    expect(stepNumber(10, 1, { max: 10 })).toBe(10);
    expect(stepNumber(0, -1, { min: 1 })).toBe(1);
  });

  it("bước thập phân không ra số lẻ do số thực", () => {
    expect(stepNumber(0.1, 1, { step: 0.2 })).toBe(0.3);
    expect(stepNumber(0.4, -1, { step: 0.1 })).toBe(0.3);
  });
});

describe("canStep", () => {
  it("tắt nút khi đã chạm min / max", () => {
    expect(canStep(1, -1, { min: 1 })).toBe(false);
    expect(canStep(1, 1, { min: 1 })).toBe(true);
    expect(canStep(10, 1, { max: 10 })).toBe(false);
    expect(canStep(5, 1)).toBe(true);
  });
});
