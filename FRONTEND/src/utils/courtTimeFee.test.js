import { describe, expect, it } from "vitest";
import { COURT_TIME_ERROR, calculateCourtTimeFee } from "./courtTimeFee";

const court = (start, end) => ({ start, end });

describe("calculateCourtTimeFee", () => {
  it("ví dụ 2 sân 21:00→21:10 và 21:00→21:15: tổng 29.167đ làm tròn lên 30.000đ", () => {
    const result = calculateCourtTimeFee([
      court("21:00", "21:10"),
      court("21:00", "21:15"),
    ]);

    expect(result.lines.map((l) => l.minutes)).toEqual([10, 15]);
    expect(result.lines[0].amount).toBeCloseTo(11666.67, 2);
    expect(result.lines[1].amount).toBe(17500);
    expect(result.exactTotal).toBeCloseTo(29166.67, 2);
    expect(result.total).toBe(30000);
    expect(result.hasValid).toBe(true);
  });

  it("tổng chẵn nghìn thì giữ nguyên: 2 giờ một sân là 140.000đ", () => {
    const result = calculateCourtTimeFee([court("21:00", "23:00")]);

    expect(result.total).toBe(140000);
  });

  it("lẻ một đồng cũng làm tròn lên nghìn kế tiếp: 1 phút ra 2.000đ", () => {
    const result = calculateCourtTimeFee([court("21:00", "21:01")]);

    expect(result.total).toBe(2000);
  });

  it("sân chưa nhập giờ kết thúc: không tính, không báo lỗi", () => {
    const result = calculateCourtTimeFee([court("21:00", "")]);

    expect(result.lines[0]).toEqual({ minutes: null, amount: 0, error: null });
    expect(result.total).toBe(0);
    expect(result.hasValid).toBe(false);
  });

  it("giờ kết thúc không sau giờ bắt đầu: báo lỗi, tính 0đ, sân khác vẫn tính", () => {
    const result = calculateCourtTimeFee([
      court("21:00", "20:50"),
      court("21:00", "21:00"),
      court("21:00", "21:30"),
    ]);

    expect(result.lines[0]).toEqual({
      minutes: null,
      amount: 0,
      error: COURT_TIME_ERROR,
    });
    expect(result.lines[1].error).toBe(COURT_TIME_ERROR);
    expect(result.total).toBe(35000);
    expect(result.hasValid).toBe(true);
  });

  it("nhận giờ có cả giây (HH:MM:SS) như ô giờ của trình duyệt có thể trả về", () => {
    const result = calculateCourtTimeFee([court("21:00:00", "21:15:00")]);

    expect(result.lines[0].minutes).toBe(15);
  });
});
