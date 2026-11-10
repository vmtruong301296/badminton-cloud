import { describe, expect, it } from "vitest";
import {
  COURT_TIME_ERROR,
  DEFAULT_COURT_START,
  calculateCourtTimeFee,
  courtPriceForDate,
  courtRowsFromSlots,
  courtSlotsPayload,
} from "./courtTimeFee";

const PRICE = 140000;
const court = (start, end) => ({ start, end });

describe("calculateCourtTimeFee", () => {
  it("ví dụ 2 sân 21:00→21:10 và 21:00→21:15: tổng 29.167đ làm tròn lên 30.000đ", () => {
    const result = calculateCourtTimeFee(
      [court("21:00", "21:10"), court("21:00", "21:15")],
      PRICE,
    );

    expect(result.lines.map((l) => l.minutes)).toEqual([10, 15]);
    expect(result.lines[0].amount).toBeCloseTo(11666.67, 2);
    expect(result.lines[1].amount).toBe(17500);
    expect(result.exactTotal).toBeCloseTo(29166.67, 2);
    expect(result.total).toBe(30000);
    expect(result.hasValid).toBe(true);
  });

  it("tổng chẵn nghìn thì giữ nguyên: 2 giờ một sân là 140.000đ", () => {
    const result = calculateCourtTimeFee([court("21:00", "23:00")], PRICE);

    expect(result.total).toBe(140000);
  });

  it("tính theo giá truyền vào: lên 150k thì 10 phút ra 12.500đ, làm tròn lên 13.000đ", () => {
    const result = calculateCourtTimeFee([court("21:00", "21:10")], 150000);

    expect(result.lines[0].amount).toBe(12500);
    expect(result.total).toBe(13000);
  });

  it("lẻ một đồng cũng làm tròn lên nghìn kế tiếp: 1 phút ra 2.000đ", () => {
    const result = calculateCourtTimeFee([court("21:00", "21:01")], PRICE);

    expect(result.total).toBe(2000);
  });

  it("sân chưa nhập giờ kết thúc: không tính, không báo lỗi", () => {
    const result = calculateCourtTimeFee([court("21:00", "")], PRICE);

    expect(result.lines[0]).toEqual({ minutes: null, amount: 0, error: null });
    expect(result.total).toBe(0);
    expect(result.hasValid).toBe(false);
  });

  it("giờ kết thúc không sau giờ bắt đầu: báo lỗi, tính 0đ, sân khác vẫn tính", () => {
    const result = calculateCourtTimeFee(
      [
        court("21:00", "20:50"),
        court("21:00", "21:00"),
        court("21:00", "21:30"),
      ],
      PRICE,
    );

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
    const result = calculateCourtTimeFee(
      [court("21:00:00", "21:15:00")],
      PRICE,
    );

    expect(result.lines[0].minutes).toBe(15);
  });
});

describe("courtPriceForDate", () => {
  const prices = [
    { effective_from: "1970-01-01", price: 140000 },
    { effective_from: "2026-12-01", price: 150000 },
  ];

  it("lấy mốc giá mới nhất không sau ngày bill", () => {
    expect(courtPriceForDate(prices, "2026-11-30")).toBe(140000);
    expect(courtPriceForDate(prices, "2026-12-01")).toBe(150000);
    expect(courtPriceForDate(prices, "2027-01-15")).toBe(150000);
  });

  it("chưa có giá (đang tải, lỗi) hoặc chưa có mốc nào trước ngày bill thì null", () => {
    expect(courtPriceForDate([], "2026-11-30")).toBeNull();
    expect(courtPriceForDate(null, "2026-11-30")).toBeNull();
    expect(
      courtPriceForDate(
        [{ effective_from: "2026-12-01", price: 150000 }],
        "2026-11-30",
      ),
    ).toBeNull();
  });
});

describe("courtRowsFromSlots", () => {
  it("khung giờ đã lưu thành các dòng sân có key", () => {
    expect(
      courtRowsFromSlots([
        { start: "21:00", end: "21:10" },
        { start: "21:00", end: "21:22" },
      ]),
    ).toEqual([
      { key: 1, start: "21:00", end: "21:10" },
      { key: 2, start: "21:00", end: "21:22" },
    ]);
  });

  it("chưa lưu khung giờ (bill cũ, bill mới) thì một dòng Sân 1 bắt đầu 21:00", () => {
    const blank = [{ key: 1, start: DEFAULT_COURT_START, end: "" }];

    expect(courtRowsFromSlots(null)).toEqual(blank);
    expect(courtRowsFromSlots(undefined)).toEqual(blank);
    expect(courtRowsFromSlots([])).toEqual(blank);
  });
});

describe("courtSlotsPayload", () => {
  it("chỉ gửi dòng đủ giờ và hợp lệ, bỏ key, giờ về dạng HH:MM", () => {
    expect(
      courtSlotsPayload([
        { key: 1, start: "21:00", end: "21:10" },
        { key: 2, start: "21:00", end: "" },
        { key: 3, start: "21:00", end: "20:50" },
        { key: 4, start: "21:00:00", end: "21:22:00" },
      ]),
    ).toEqual([
      { start: "21:00", end: "21:10" },
      { start: "21:00", end: "21:22" },
    ]);
  });

  it("không có dòng thì mảng rỗng", () => {
    expect(courtSlotsPayload(undefined)).toEqual([]);
  });
});
