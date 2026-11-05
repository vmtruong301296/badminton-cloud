import { describe, expect, it } from "vitest";
import { KEYBOARD_OPEN_MIN, keyboardInset } from "./keyboardInset";

describe("keyboardInset", () => {
  it("phần khung bố cục bị bàn phím che = cao cửa sổ − cao khung nhìn − độ cuộn khung nhìn", () => {
    // iPhone 390 × 844: bàn phím + thanh "Xong" che 336 px
    expect(keyboardInset({ innerHeight: 844, height: 508, offsetTop: 0 })).toBe(336);
    // Safari đã đẩy khung nhìn lên 120 px để thấy ô đang nhập
    expect(keyboardInset({ innerHeight: 844, height: 508, offsetTop: 120 })).toBe(216);
  });

  it("không có bàn phím thì 0, không bao giờ âm", () => {
    expect(keyboardInset({ innerHeight: 844, height: 844, offsetTop: 0 })).toBe(0);
    // Thanh địa chỉ thu lại làm khung nhìn cao hơn cửa sổ một chút
    expect(keyboardInset({ innerHeight: 800, height: 812, offsetTop: 0 })).toBe(0);
  });

  it("làm tròn số lẻ do phóng to", () => {
    expect(keyboardInset({ innerHeight: 844, height: 507.6, offsetTop: 0.2 })).toBe(336);
  });

  it("thiếu số liệu (trình duyệt không có visualViewport) thì 0", () => {
    expect(keyboardInset(null)).toBe(0);
    expect(keyboardInset({ innerHeight: 844 })).toBe(0);
  });

  it("ngưỡng coi là bàn phím đang mở lớn hơn thanh địa chỉ co giãn", () => {
    expect(KEYBOARD_OPEN_MIN).toBeGreaterThan(100);
  });
});
