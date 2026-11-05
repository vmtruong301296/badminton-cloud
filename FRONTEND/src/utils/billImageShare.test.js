import { describe, expect, it } from "vitest";
import {
  activePaymentAccounts,
  apiErrorDetail,
  defaultPaymentAccountId,
  onlyActivePaymentAccountId,
  pickImageSaveMethod,
} from "./billImageShare";

const acc = (id, bank_name, is_active = true) => ({ id, bank_name, is_active });

describe("activePaymentAccounts", () => {
  it("chỉ giữ tài khoản đang bật", () => {
    const list = [acc(1, "VPBank"), acc(2, "MB Bank", false)];
    expect(activePaymentAccounts(list).map((a) => a.id)).toEqual([1]);
    expect(activePaymentAccounts(undefined)).toEqual([]);
  });
});

describe("defaultPaymentAccountId", () => {
  it("chọn sẵn VPBank nếu có (như hộp chọn tài khoản hiện nay)", () => {
    expect(
      defaultPaymentAccountId([acc(2, "Techcombank"), acc(1, "VPBank")]),
    ).toBe(1);
  });

  it("không có VPBank đang bật thì chọn tài khoản đang bật đầu tiên", () => {
    expect(
      defaultPaymentAccountId([
        acc(1, "VPBank", false),
        acc(2, "Techcombank"),
        acc(3, "MB Bank"),
      ]),
    ).toBe(2);
  });

  it("không có tài khoản đang bật thì null", () => {
    expect(defaultPaymentAccountId([acc(1, "VPBank", false)])).toBeNull();
    expect(defaultPaymentAccountId([])).toBeNull();
  });
});

describe("onlyActivePaymentAccountId", () => {
  it("đúng 1 tài khoản đang bật thì trả id để bỏ qua bước chọn (quyết định 12)", () => {
    expect(
      onlyActivePaymentAccountId([acc(1, "VPBank", false), acc(2, "MB Bank")]),
    ).toBe(2);
  });

  it("0 hoặc từ 2 tài khoản đang bật thì null", () => {
    expect(onlyActivePaymentAccountId([])).toBeNull();
    expect(
      onlyActivePaymentAccountId([acc(1, "VPBank"), acc(2, "MB Bank")]),
    ).toBeNull();
  });
});

describe("pickImageSaveMethod", () => {
  it("máy cảm ứng chia sẻ được file thì mở bảng chia sẻ (quyết định 11)", () => {
    expect(
      pickImageSaveMethod({ coarsePointer: true, canShareFiles: true }),
    ).toBe("share");
  });

  it("máy không hỗ trợ chia sẻ file thì tải file như cũ", () => {
    expect(
      pickImageSaveMethod({ coarsePointer: true, canShareFiles: false }),
    ).toBe("download");
  });

  it("máy tính (chuột) vẫn tải file dù trình duyệt chia sẻ được", () => {
    expect(
      pickImageSaveMethod({ coarsePointer: false, canShareFiles: true }),
    ).toBe("download");
  });
});

describe("apiErrorDetail", () => {
  it("ưu tiên error rồi message của máy chủ, rồi lỗi trình duyệt", () => {
    expect(
      apiErrorDetail({
        response: { data: { error: "Telegram chưa được cấu hình" } },
      }),
    ).toBe("Telegram chưa được cấu hình");
    expect(
      apiErrorDetail({ response: { data: { message: "Server Error" } } }),
    ).toBe("Server Error");
    expect(apiErrorDetail(new Error("Network Error"))).toBe("Network Error");
  });

  it("không có gì thì Lỗi không xác định (câu cũ)", () => {
    expect(apiErrorDetail(undefined)).toBe("Lỗi không xác định");
  });
});
