import { describe, expect, it } from "vitest";
import {
  BILL_FORM_MESSAGES,
  billFormErrorList,
  serverErrorMessage,
  sumPlayerRatios,
  validateBillForm,
} from "./billFormErrors";

const player = (overrides = {}) => ({
  user_id: 1,
  ratio_value: 1,
  default_ratio_value: 1,
  ...overrides,
});

const shuttle = (overrides = {}) => ({
  shuttle_type_id: 7,
  quantity: 12,
  ...overrides,
});

const validForm = (overrides = {}) => ({
  court_total: 280000,
  shuttles: [shuttle()],
  players: [player()],
  ...overrides,
});

describe("sumPlayerRatios", () => {
  it("lấy mức tính đang chọn, thiếu thì mức mặc định, thiếu nữa thì 1", () => {
    const players = [
      player({ ratio_value: 0.4 }),
      player({ ratio_value: null, default_ratio_value: 0.7 }),
      { user_id: 3 },
    ];
    expect(sumPlayerRatios(players)).toBeCloseTo(2.1);
  });

  it("mức tính dạng chuỗi từ API vẫn cộng số", () => {
    expect(
      sumPlayerRatios([
        player({ ratio_value: "0.700" }),
        player({ ratio_value: "1.000" }),
      ]),
    ).toBeCloseTo(1.7);
  });
});

describe("validateBillForm", () => {
  it("form hợp lệ thì không có lỗi", () => {
    expect(billFormErrorList(validateBillForm(validForm()))).toEqual([]);
  });

  it("chưa chọn người chơi: lỗi ở khối người chơi, giữ câu cũ", () => {
    const errors = validateBillForm(validForm({ players: [] }));
    expect(errors.players).toBe(BILL_FORM_MESSAGES.noPlayers);
    expect(errors.players).toBe("Vui lòng chọn ít nhất một người chơi");
  });

  it("tổng mức tính bằng 0: lỗi ở khối người chơi", () => {
    const errors = validateBillForm(
      validForm({
        players: [player({ ratio_value: 0, default_ratio_value: 0 })],
      }),
    );
    expect(errors.players).toBe("Tổng mức tính phải lớn hơn 0");
  });

  it("không có loại cầu hợp lệ và tiền sân 0: lỗi ở ô tiền sân", () => {
    const errors = validateBillForm(
      validForm({
        court_total: 0,
        shuttles: [shuttle({ shuttle_type_id: null })],
      }),
    );
    expect(errors.court).toBe(
      "Vui lòng thêm ít nhất một loại cầu hợp lệ hoặc nhập tổng tiền sân lớn hơn 0",
    );
  });

  it("không có cầu nhưng tiền sân > 0 thì hợp lệ (bill con chỉ tiền sân)", () => {
    expect(
      billFormErrorList(validateBillForm(validForm({ shuttles: [] }))),
    ).toEqual([]);
  });

  it("dòng cầu 0 quả: lỗi đúng dòng đó, theo chỉ số gốc", () => {
    const errors = validateBillForm(
      validForm({
        shuttles: [
          shuttle(),
          shuttle({ shuttle_type_id: null, quantity: 0 }),
          shuttle({ quantity: 0 }),
        ],
      }),
    );
    expect(errors.shuttleQuantity).toEqual({
      2: "Số lượng cầu phải lớn hơn 0",
    });
  });
});

describe("billFormErrorList", () => {
  it("xếp theo thứ tự trên màn: tiền sân, từng dòng cầu, người chơi", () => {
    const errors = validateBillForm({
      court_total: 0,
      shuttles: [shuttle({ shuttle_type_id: null }), shuttle({ quantity: 0 })],
      players: [],
    });
    // Dòng cầu 1 có loại → có cầu hợp lệ nên ô tiền sân không lỗi
    expect(billFormErrorList(errors).map((e) => e.field)).toEqual([
      "shuttle-1",
      "players",
    ]);
  });

  it("đủ ba loại lỗi", () => {
    const errors = validateBillForm({
      court_total: 0,
      shuttles: [],
      players: [],
    });
    expect(billFormErrorList(errors)).toEqual([
      { field: "court", message: BILL_FORM_MESSAGES.noShuttleOrCourt },
      { field: "players", message: BILL_FORM_MESSAGES.noPlayers },
    ]);
  });
});

describe("serverErrorMessage", () => {
  it("ưu tiên message của máy chủ", () => {
    expect(
      serverErrorMessage({
        message: "x",
        response: { data: { message: "Ngày không hợp lệ" } },
      }),
    ).toBe("Ngày không hợp lệ");
  });

  it("máy chủ trả { error } (lỗi 500 của BillController) thì đọc error", () => {
    expect(
      serverErrorMessage({
        message: "Request failed with status code 500",
        response: { data: { error: "SQLSTATE[23000]" } },
      }),
    ).toBe("SQLSTATE[23000]");
  });

  it("không có phản hồi (mất mạng) thì dùng message của axios", () => {
    expect(serverErrorMessage({ message: "Network Error" })).toBe(
      "Network Error",
    );
  });
});
