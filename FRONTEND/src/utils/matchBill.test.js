import { describe, expect, it } from "vitest";
import {
  MATCH_FORM_MESSAGES,
  calculateMatchPreview,
  isMatchSplit,
  matchDisplayLines,
  playerWeightLabel,
  defaultMatchShuttleTypeId,
  matchBillPayload,
  matchCandidates,
  matchFormErrorList,
  matchFormFromBill,
  setMatchSize,
  toggleMatchPlayer,
  validateMatchForm,
} from "./matchBill";

const S70 = { id: 1, name: "Cầu S70", price_for_bill: 26000 };
const THANH_CONG = { id: 2, name: "Cầu Thành Công", price: 28000 };
const TYPES = [THANH_CONG, S70];

const [TRUONG, NGUYEN, HIEN, HUYNH, LOC, TAN] = [11, 12, 13, 14, 15, 16];

const match = (
  player_ids,
  shuttle_type_id = S70.id,
  quantity = 1,
  size = 4,
) => ({
  size,
  player_ids,
  shuttle_type_id,
  quantity,
});

describe("calculateMatchPreview", () => {
  it("chia đúng ví dụ sân 55k, 2 trận như máy chủ", () => {
    const preview = calculateMatchPreview(
      55000,
      [
        match([TRUONG, NGUYEN, HIEN, HUYNH], S70.id, 1),
        match([TRUONG, HIEN, LOC, TAN], THANH_CONG.id, 2),
      ],
      TYPES,
    );

    expect(preview.total_shuttle_price).toBe(82000);
    expect(preview.total_amount).toBe(137000);
    expect(preview.players).toEqual([
      { user_id: TRUONG, match_count: 2, share_amount: 34250 },
      { user_id: NGUYEN, match_count: 1, share_amount: 13375 },
      { user_id: HIEN, match_count: 2, share_amount: 34250 },
      { user_id: HUYNH, match_count: 1, share_amount: 13375 },
      { user_id: LOC, match_count: 1, share_amount: 20875 },
      { user_id: TAN, match_count: 1, share_amount: 20875 },
    ]);
    expect(preview.matches[0]).toEqual({
      subtotal: 26000,
      court_share: 6875,
      shuttle_share: 6500,
      per_player: 13375,
    });
  });

  it("trận đơn chia sân và cầu của trận cho 2 người", () => {
    const preview = calculateMatchPreview(
      60000,
      [
        match([TRUONG, NGUYEN, HIEN, HUYNH], S70.id, 1),
        match([TRUONG, NGUYEN], THANH_CONG.id, 1, 2),
      ],
      TYPES,
    );

    expect(preview.matches[1].per_player).toBe(30000 / 2 + 28000 / 2);
    expect(preview.players[0].share_amount).toBe(14000 + 29000);
  });

  it("trận chưa chọn đủ người vẫn chia theo số người của trận", () => {
    const preview = calculateMatchPreview(40000, [match([TRUONG])], TYPES);
    expect(preview.players).toEqual([
      { user_id: TRUONG, match_count: 1, share_amount: 16500 },
    ]);
  });

  it("chưa có trận: chỉ có tiền sân, không ai trả", () => {
    expect(calculateMatchPreview(55000, [], TYPES)).toMatchObject({
      total_amount: 55000,
      total_shuttle_price: 0,
      players: [],
    });
  });
});

describe("toggleMatchPlayer / setMatchSize", () => {
  it("chọn thêm khi còn chỗ, bấm lại thì bỏ", () => {
    const m = toggleMatchPlayer(match([TRUONG]), NGUYEN);
    expect(m.player_ids).toEqual([TRUONG, NGUYEN]);
    expect(toggleMatchPlayer(m, TRUONG).player_ids).toEqual([NGUYEN]);
  });

  it("đủ người thì không chọn thêm", () => {
    const full = match([TRUONG, NGUYEN, HIEN, HUYNH]);
    expect(toggleMatchPlayer(full, LOC)).toBe(full);
  });

  it("đổi sang đơn thì giữ 2 người chọn trước", () => {
    expect(setMatchSize(match([TRUONG, NGUYEN, HIEN]), 2)).toMatchObject({
      size: 2,
      player_ids: [TRUONG, NGUYEN],
    });
  });
});

describe("validateMatchForm", () => {
  it("báo trận thiếu người, chưa chọn cầu, 0 quả, theo thứ tự trên màn", () => {
    const errors = validateMatchForm({
      matches: [
        match([TRUONG, NGUYEN, HIEN]),
        match([TRUONG, NGUYEN], null, 1, 2),
        match([TRUONG, NGUYEN, HIEN, HUYNH], S70.id, 0),
      ],
    });

    expect(matchFormErrorList(errors)).toEqual([
      { field: "match-0-players", message: MATCH_FORM_MESSAGES.players(4) },
      { field: "match-1-shuttle", message: MATCH_FORM_MESSAGES.noShuttle },
      { field: "match-2-quantity", message: MATCH_FORM_MESSAGES.zeroQuantity },
    ]);
  });

  it("chưa có trận nào", () => {
    expect(matchFormErrorList(validateMatchForm({ matches: [] }))).toEqual([
      { field: "matches", message: MATCH_FORM_MESSAGES.noMatches },
    ]);
  });

  it("đủ người, có cầu thì không lỗi", () => {
    const errors = validateMatchForm({
      matches: [
        match([TRUONG, NGUYEN, HIEN, HUYNH]),
        match([LOC, TAN], S70.id, 1, 2),
      ],
    });
    expect(matchFormErrorList(errors)).toEqual([]);
  });
});

describe("matchBillPayload", () => {
  it("gửi split_mode match và từng trận, bỏ size và key", () => {
    expect(
      matchBillPayload({
        date: "2026-11-08",
        note: "",
        court_total: 55000,
        matches: [{ key: 7, ...match([TRUONG, NGUYEN], S70.id, "2", 2) }],
      }),
    ).toEqual({
      date: "2026-11-08",
      note: null,
      court_total: 55000,
      split_mode: "match",
      matches: [
        { player_ids: [TRUONG, NGUYEN], shuttle_type_id: S70.id, quantity: 2 },
      ],
    });
  });
});

describe("defaultMatchShuttleTypeId", () => {
  it("ưu tiên Cầu S70, không có thì loại đầu tiên", () => {
    expect(defaultMatchShuttleTypeId(TYPES)).toBe(S70.id);
    expect(defaultMatchShuttleTypeId([THANH_CONG])).toBe(THANH_CONG.id);
    expect(defaultMatchShuttleTypeId([])).toBeNull();
  });
});

describe("matchCandidates", () => {
  it("người của bill chính trước, thêm người đã có trong trận mà ngoài bill chính", () => {
    const parentPlayers = [
      { user_id: TRUONG, user: { name: "Trường" } },
      { user_id: NGUYEN, user: { name: "Nguyên" } },
    ];
    const matches = [
      {
        players: [
          { id: NGUYEN, name: "Nguyên" },
          { id: LOC, name: "Lộc" },
        ],
      },
    ];
    expect(matchCandidates(parentPlayers, matches)).toEqual([
      { user_id: TRUONG, name: "Trường" },
      { user_id: NGUYEN, name: "Nguyên" },
      { user_id: LOC, name: "Lộc" },
    ]);
  });
});

describe("matchFormFromBill", () => {
  it("đổi bill chia theo trận của API về dữ liệu form", () => {
    const form = matchFormFromBill({
      date: "2026-11-08T00:00:00.000000Z",
      note: "Sau 9h",
      court_total: 55000,
      matches: [
        {
          shuttle_type_id: S70.id,
          quantity: 1,
          players: [{ id: TRUONG }, { id: NGUYEN }],
        },
      ],
    });
    expect(form).toEqual({
      date: "2026-11-08",
      note: "Sau 9h",
      court_total: 55000,
      matches: [match([TRUONG, NGUYEN], S70.id, 1, 2)],
    });
  });
});

describe("isMatchSplit / playerWeightLabel", () => {
  it("bill chia theo trận hiện 'Số trận' thay cho 'Mức tính'", () => {
    expect(isMatchSplit({ split_mode: "match" })).toBe(true);
    expect(isMatchSplit({ split_mode: "ratio" })).toBe(false);
    expect(isMatchSplit(null)).toBe(false);
    expect(playerWeightLabel({ split_mode: "match" })).toBe("Số trận");
    expect(playerWeightLabel({})).toBe("Mức tính");
  });
});

describe("matchDisplayLines", () => {
  it("dòng từng trận từ bill của API: tên người, cầu, tiền mỗi người", () => {
    const lines = matchDisplayLines({
      court_total: 55000,
      matches: [
        {
          id: 1,
          position: 1,
          quantity: 1,
          subtotal: 26000,
          shuttle_type: { name: "Cầu S70" },
          players: [
            { id: TRUONG, name: "Trường" },
            { id: NGUYEN, name: "Nguyên" },
            { id: HIEN, name: "Hiển" },
            { id: HUYNH, name: "Huỳnh" },
          ],
        },
        {
          id: 2,
          position: 2,
          quantity: 2,
          subtotal: 56000,
          shuttle_type: { name: "Cầu Thành Công" },
          players: [
            { id: TRUONG, name: "Trường" },
            { id: LOC, name: "Lộc" },
          ],
        },
      ],
    });

    expect(lines).toEqual([
      {
        id: 1,
        position: 1,
        kind: "Đôi",
        names: ["Trường", "Nguyên", "Hiển", "Huỳnh"],
        shuttle_name: "Cầu S70",
        quantity: 1,
        subtotal: 26000,
        per_player: 13375,
      },
      {
        id: 2,
        position: 2,
        kind: "Đơn",
        names: ["Trường", "Lộc"],
        shuttle_name: "Cầu Thành Công",
        quantity: 2,
        subtotal: 56000,
        per_player: 41750,
      },
    ]);
  });
});
