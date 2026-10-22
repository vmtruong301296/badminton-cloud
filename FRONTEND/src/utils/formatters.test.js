import { describe, expect, it } from "vitest";
import { formatRatio } from "./formatters";

describe("formatRatio", () => {
  it("bỏ sai số cộng số thực khi tổng mức tính", () => {
    expect(formatRatio(22.250000000000004)).toBe("22.25");
    expect(formatRatio(0.1 + 0.2)).toBe("0.3");
  });

  it("bỏ số 0 thừa ở chuỗi thập phân API trả về", () => {
    expect(formatRatio("1.000")).toBe("1");
    expect(formatRatio("0.750")).toBe("0.75");
    expect(formatRatio("1.125")).toBe("1.125");
  });

  it("trả chuỗi rỗng khi không có giá trị hoặc không phải số", () => {
    expect(formatRatio(null)).toBe("");
    expect(formatRatio(undefined)).toBe("");
    expect(formatRatio("abc")).toBe("");
  });
});
