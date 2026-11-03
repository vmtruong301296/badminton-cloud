import { describe, expect, it } from "vitest";
import { calculateBillPreview, formatRatio } from "./formatters";

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

describe("calculateBillPreview", () => {
  it("tiền cộng thêm của người chơi nằm trong chi phí thêm và tổng tiền", () => {
    const preview = calculateBillPreview(
      200000,
      [],
      [
        {
          ratio_value: 1,
          menus: [{ subtotal: 30000 }],
          extra_amount: 10000,
          extra_note: "Tiền cộng thêm 10k ở trận trước",
        },
      ],
    );

    expect(preview.players[0].menu_extra_total).toBe(40000);
    expect(preview.players[0].total_amount).toBe(240000);
  });

  it("không nhập cộng thêm thì chi phí thêm chỉ là tiền menu", () => {
    const preview = calculateBillPreview(100000, [], [
      { ratio_value: 1, menus: [{ subtotal: 5000 }] },
    ]);

    expect(preview.players[0].menu_extra_total).toBe(5000);
    expect(preview.players[0].total_amount).toBe(105000);
  });
});
