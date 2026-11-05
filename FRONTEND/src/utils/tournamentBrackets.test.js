import { describe, expect, it } from "vitest";
import {
  bracketExportSummary,
  genderLabel,
  orderBracketPlayers,
  playerBracketName,
  sortBrackets,
} from "./tournamentBrackets";

const player = (id, gender, level = 1) => ({
  id,
  name: `VĐV ${id}`,
  gender,
  level,
});

describe("sortBrackets", () => {
  it("xếp bảng chỉ nam, chỉ nữ rồi mới tới bảng chia đều, kiểu lạ xuống cuối", () => {
    const brackets = [
      { id: 1, gender_distribution: "mixed" },
      { id: 2, gender_distribution: "other" },
      { id: 3, gender_distribution: "female_only" },
      { id: 4, gender_distribution: "male_only" },
    ];

    expect(sortBrackets(brackets).map((b) => b.id)).toEqual([4, 3, 1, 2]);
  });

  it("giữ thứ tự API cho các bảng cùng kiểu và không sửa mảng gốc", () => {
    const brackets = [
      { id: 1, gender_distribution: "mixed" },
      { id: 2, gender_distribution: "male_only" },
      { id: 3, gender_distribution: "mixed" },
    ];

    expect(sortBrackets(brackets).map((b) => b.id)).toEqual([2, 1, 3]);
    expect(brackets.map((b) => b.id)).toEqual([1, 2, 3]);
  });
});

describe("orderBracketPlayers", () => {
  it("đưa nam lên trước nữ, giữ thứ tự trong từng nhóm", () => {
    const players = [
      player(1, "female"),
      player(2, "male"),
      player(3, "female"),
      player(4, "male"),
    ];

    expect(orderBracketPlayers(players).map((p) => p.id)).toEqual([2, 4, 1, 3]);
    expect(players.map((p) => p.id)).toEqual([1, 2, 3, 4]);
  });

  it("trả mảng rỗng khi bảng chưa có VĐV", () => {
    expect(orderBracketPlayers(undefined)).toEqual([]);
  });
});

describe("bracketExportSummary", () => {
  it("đếm VĐV trong các bảng và ghi kiểu phân bổ", () => {
    const brackets = [
      {
        gender_distribution: "mixed",
        players: [player(1, "male"), player(2, "female")],
      },
      { gender_distribution: "mixed", players: [player(3, "male")] },
    ];

    expect(bracketExportSummary(brackets)).toEqual({
      playerCount: 3,
      bracketCount: 2,
      distributionLabel: "Chia đều giới tính",
    });
  });

  it("nhiều kiểu phân bổ thì ghi đủ, theo thứ tự hiển thị của bảng", () => {
    const brackets = [
      { gender_distribution: "mixed", players: [] },
      { gender_distribution: "female_only", players: [player(1, "female")] },
      { gender_distribution: "male_only", players: [player(2, "male")] },
    ];

    expect(bracketExportSummary(brackets).distributionLabel).toBe(
      "Chỉ nam · Chỉ nữ · Chia đều giới tính",
    );
  });

  it("bỏ qua kiểu phân bổ không biết tên", () => {
    const brackets = [{ gender_distribution: "other", players: [] }];

    expect(bracketExportSummary(brackets)).toEqual({
      playerCount: 0,
      bracketCount: 1,
      distributionLabel: "",
    });
  });
});

describe("playerBracketName", () => {
  it("lấy tên bảng API trả về cho VĐV đã xếp", () => {
    expect(playerBracketName({ brackets: [{ id: 9, name: "Bảng 2" }] })).toBe(
      "Bảng 2",
    );
  });

  it("trả null khi VĐV chưa xếp bảng", () => {
    expect(playerBracketName({ brackets: [] })).toBeNull();
    expect(playerBracketName({})).toBeNull();
  });
});

describe("genderLabel", () => {
  it("đổi giá trị API sang chữ hiển thị", () => {
    expect(genderLabel("male")).toBe("Nam");
    expect(genderLabel("female")).toBe("Nữ");
  });
});
