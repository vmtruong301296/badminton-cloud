import { describe, expect, it } from "vitest";
import {
  calculateBillPreview,
  formatDateShort,
  formatRatio,
  formatTimeShort,
} from "./formatters";

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

describe("formatDateShort", () => {
  // Hôm nay = Thứ Năm 05/11/2026 (giờ máy)
  const now = new Date(2026, 10, 5, 9, 30);

  it("cùng năm: thứ viết tắt + ngày/tháng", () => {
    expect(formatDateShort("2026-11-05", now)).toBe("T5, 05/11");
    expect(formatDateShort("2026-11-04", now)).toBe("T4, 04/11");
    expect(formatDateShort("2026-10-31", now)).toBe("T7, 31/10");
  });

  it("Chủ nhật in CN", () => {
    expect(formatDateShort("2026-11-01", now)).toBe("CN, 01/11");
  });

  it("khác năm (trước hoặc sau): không thứ, có năm", () => {
    expect(formatDateShort("2025-12-15", now)).toBe("15/12/2025");
    expect(formatDateShort("2025-11-04", now)).toBe("04/11/2025");
    expect(formatDateShort("2027-01-02", now)).toBe("02/01/2027");
  });

  it("chuỗi ngày đọc theo giờ máy, không lệch ngày vì UTC", () => {
    // Laravel cast date trả nửa đêm UTC: vẫn là ngày 04/11
    expect(formatDateShort("2026-11-04T00:00:00.000000Z", now)).toBe("T4, 04/11");
    expect(formatDateShort(new Date(2026, 10, 4, 23, 59), now)).toBe("T4, 04/11");
  });

  it("không có giá trị hoặc sai thì trả chuỗi rỗng", () => {
    expect(formatDateShort(null, now)).toBe("");
    expect(formatDateShort(undefined, now)).toBe("");
    expect(formatDateShort("", now)).toBe("");
    expect(formatDateShort("không phải ngày", now)).toBe("");
  });

  it("mặc định so với ngày hiện tại", () => {
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(formatDateShort(iso)).toMatch(/^(CN|T[2-7]), \d{2}\/\d{2}$/);
  });
});

describe("formatTimeShort", () => {
  it("giờ:phút theo giờ máy, 24 giờ", () => {
    expect(formatTimeShort(new Date(2026, 10, 4, 21, 13, 45))).toBe("21:13");
    expect(formatTimeShort(new Date(2026, 10, 4, 7, 5))).toBe("07:05");
  });

  it("đọc được chuỗi ISO", () => {
    const value = new Date(2026, 10, 4, 21, 13).toISOString();
    expect(formatTimeShort(value)).toBe("21:13");
  });

  it("không có giá trị hoặc sai thì trả chuỗi rỗng", () => {
    expect(formatTimeShort(null)).toBe("");
    expect(formatTimeShort("abc")).toBe("");
  });
});
