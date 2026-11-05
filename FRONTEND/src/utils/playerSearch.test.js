import { describe, expect, it } from "vitest";
import {
  filterPickerPlayers,
  findPlayerByName,
  firstUnselectedPlayer,
  matchesPlayerSearch,
  normalizeSearch,
  orderPickerPlayers,
} from "./playerSearch";

const p = (id, name) => ({ id, name });

// Thứ tự API: số bill giảm dần
const PLAYERS = [
  p(1, "Hoàng Nam"),
  p(2, "Quang Huy"),
  p(3, "Minh Anh"),
  p(4, "Đức Thắng"),
  p(5, "Huy Hoàng"),
];

describe("normalizeSearch", () => {
  it("bỏ dấu, chữ thường, gộp khoảng trắng", () => {
    expect(normalizeSearch("  Đức   THẮNG ")).toBe("duc thang");
  });

  it("chịu được giá trị rỗng", () => {
    expect(normalizeSearch()).toBe("");
    expect(normalizeSearch(null)).toBe("");
  });
});

describe("matchesPlayerSearch", () => {
  it("gõ không dấu vẫn khớp tên có dấu", () => {
    expect(matchesPlayerSearch("Đức Thắng", "duc th")).toBe(true);
    expect(
      matchesPlayerSearch("Nguyễn Thị Hoàng Bảo Ngọc Trâm", "ngoc tram"),
    ).toBe(true);
  });

  it("ô tìm trống thì mọi tên đều khớp", () => {
    expect(matchesPlayerSearch("Minh Anh", "   ")).toBe(true);
  });

  it("không khớp thì false", () => {
    expect(matchesPlayerSearch("Minh Anh", "huy")).toBe(false);
  });
});

describe("filterPickerPlayers", () => {
  it("không gõ, không giới hạn: trả đủ danh sách, giữ thứ tự", () => {
    expect(filterPickerPlayers(PLAYERS).map((x) => x.id)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("có gõ: lọc theo tên không dấu, giữ cả người đã chọn", () => {
    expect(
      filterPickerPlayers(PLAYERS, { query: "huy" }).map((x) => x.id),
    ).toEqual([2, 5]);
  });

  it("bill con, chưa gõ: chỉ người của bill chính cộng người đang chọn", () => {
    const list = filterPickerPlayers(PLAYERS, {
      scopeIds: [1, 3],
      includeIds: [5],
    });
    expect(list.map((x) => x.id)).toEqual([1, 3, 5]);
  });

  it("bill con, có gõ: tìm trong toàn bộ người chơi", () => {
    const list = filterPickerPlayers(PLAYERS, {
      query: "thang",
      scopeIds: [1],
    });
    expect(list.map((x) => x.id)).toEqual([4]);
  });
});

describe("orderPickerPlayers", () => {
  it("người đã chọn lúc mở lên đầu, còn lại giữ thứ tự API", () => {
    expect(orderPickerPlayers(PLAYERS, [4, 2]).map((x) => x.id)).toEqual([
      2, 4, 1, 3, 5,
    ]);
  });

  it("không ai được chọn thì giữ nguyên", () => {
    expect(orderPickerPlayers(PLAYERS, []).map((x) => x.id)).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  it("không đổi mảng truyền vào", () => {
    const input = [...PLAYERS];
    orderPickerPlayers(input, [5]);
    expect(input.map((x) => x.id)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("firstUnselectedPlayer", () => {
  it("bỏ qua người đã chọn, lấy người đầu tiên còn lại", () => {
    expect(firstUnselectedPlayer(PLAYERS, [1, 2])?.id).toBe(3);
  });

  it("chọn hết rồi thì null", () => {
    expect(firstUnselectedPlayer([p(1, "A")], [1])).toBeNull();
  });
});

describe("findPlayerByName", () => {
  it("trùng tên bỏ hoa thường và khoảng trắng hai đầu", () => {
    expect(findPlayerByName(PLAYERS, "  quang HUY ")?.id).toBe(2);
  });

  it("khác dấu là người khác (giữ như kiểm tra trùng hiện nay)", () => {
    expect(findPlayerByName(PLAYERS, "Quang Huỳ")).toBeUndefined();
  });
});
