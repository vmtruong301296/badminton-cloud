import { describe, expect, it } from "vitest";
import {
  MATCH_FORM_MESSAGES,
  addMatchShuttle,
  calculateMatchPreview,
  fillDefaultShuttleTypes,
  isMatchSplit,
  matchDisplayLines,
  playerWeightLabel,
  defaultMatchShuttleTypeId,
  matchBillPayload,
  matchCandidates,
  matchFormErrorList,
  matchFormFromBill,
  setMatchSize,
  teamLabel,
  toggleTeamPlayer,
  validateMatchForm,
} from "./matchBill";

const S70 = { id: 1, name: "Cầu S70", price_for_bill: 26000 };
const THANH_CONG = { id: 2, name: "Cầu Thành Công", price: 28000 };
const TYPES = [THANH_CONG, S70];

const [TRUONG, NGUYEN, HIEN, HUYNH, LOC, TAN] = [11, 12, 13, 14, 15, 16];

/** Dòng cầu của trận từ các cặp [loại cầu, số quả]. */
const lines = (...pairs) =>
  pairs.map(([shuttle_type_id, quantity], index) => ({
    key: index + 1,
    shuttle_type_id,
    quantity,
  }));

/** Trận trong form; `players` chia đôi theo số người của trận: nửa đầu Cặp A, nửa sau Cặp B. */
const match = (players, shuttle_type_id = S70.id, quantity = 1, size = 4) => ({
  size,
  teams: [players.slice(0, size / 2), players.slice(size / 2)],
  shuttles: lines([shuttle_type_id, quantity]),
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

  it("một trận nhiều loại cầu: cộng tiền các loại rồi chia cho người đánh", () => {
    const preview = calculateMatchPreview(
      40000,
      [
        {
          ...match([TRUONG, NGUYEN, HIEN, HUYNH]),
          shuttles: lines([S70.id, 1], [THANH_CONG.id, 1]),
        },
        match([TRUONG, HIEN, LOC, TAN], S70.id, 1),
      ],
      TYPES,
    );

    expect(preview.matches[0].subtotal).toBe(26000 + 28000);
    expect(preview.total_shuttle_price).toBe(54000 + 26000);
    // Trận 1: (20.000 + 54.000) / 4; trận 2: (20.000 + 26.000) / 4
    expect(preview.players[0].share_amount).toBe(18500 + 11500);
    expect(preview.players[1].share_amount).toBe(18500);
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

describe("toggleTeamPlayer / setMatchSize / teamLabel", () => {
  it("chọn vào bên còn chỗ, bấm lại thì bỏ", () => {
    const m = toggleTeamPlayer(match([TRUONG]), 0, NGUYEN);
    expect(m.teams).toEqual([[TRUONG, NGUYEN], []]);
    expect(toggleTeamPlayer(m, 0, TRUONG).teams).toEqual([[NGUYEN], []]);
  });

  it("bên đủ người thì không chọn thêm, bên kia còn chỗ thì chọn được", () => {
    const m = match([TRUONG, NGUYEN, HIEN]);
    expect(toggleTeamPlayer(m, 0, LOC)).toBe(m);
    expect(toggleTeamPlayer(m, 1, LOC).teams).toEqual([
      [TRUONG, NGUYEN],
      [HIEN, LOC],
    ]);
  });

  it("chọn người đang ở bên kia thì chuyển sang bên này", () => {
    expect(
      toggleTeamPlayer(match([TRUONG, NGUYEN, HIEN]), 1, NGUYEN).teams,
    ).toEqual([[TRUONG], [HIEN, NGUYEN]]);
  });

  it("đổi sang đơn thì mỗi bên giữ người chọn trước", () => {
    expect(setMatchSize(match([TRUONG, NGUYEN, HIEN, HUYNH]), 2)).toMatchObject(
      { size: 2, teams: [[TRUONG], [HIEN]] },
    );
  });

  it("tên bên: đánh đôi là cặp, đánh đơn là bên", () => {
    expect([teamLabel(4, 0), teamLabel(4, 1), teamLabel(2, 1)]).toEqual([
      "Cặp A",
      "Cặp B",
      "Bên B",
    ]);
  });
});

describe("addMatchShuttle / fillDefaultShuttleTypes", () => {
  it("thêm loại cầu chưa có trong trận, ưu tiên Cầu S70", () => {
    const added = addMatchShuttle(match([], THANH_CONG.id), TYPES);
    expect(added.shuttles).toEqual(lines([THANH_CONG.id, 1], [S70.id, 1]));
    const again = addMatchShuttle(match([], S70.id), TYPES);
    expect(again.shuttles[1]).toEqual({
      key: 2,
      shuttle_type_id: THANH_CONG.id,
      quantity: 1,
    });
  });

  it("đã dùng hết loại cầu thì không thêm dòng", () => {
    const full = {
      ...match([]),
      shuttles: lines([S70.id, 1], [THANH_CONG.id, 1]),
    };
    expect(addMatchShuttle(full, TYPES)).toBe(full);
  });

  it("dòng chưa có loại nhận loại mặc định chưa dùng trong trận", () => {
    const matches = [
      { ...match([]), shuttles: lines([null, 1], [null, 2]) },
      match([TRUONG], THANH_CONG.id),
    ];
    const filled = fillDefaultShuttleTypes(matches, TYPES);
    expect(filled[0].shuttles).toEqual(lines([S70.id, 1], [THANH_CONG.id, 2]));
    expect(filled[1]).toBe(matches[1]);
  });

  it("không có dòng trống thì trả lại đúng mảng cũ", () => {
    const matches = [match([TRUONG])];
    expect(fillDefaultShuttleTypes(matches, TYPES)).toBe(matches);
  });
});

describe("validateMatchForm", () => {
  it("báo bên thiếu người (đôi / đơn), chưa chọn cầu, 0 quả, theo thứ tự trên màn", () => {
    const errors = validateMatchForm({
      court_total: 55000,
      matches: [
        match([TRUONG, NGUYEN, HIEN]),
        match([TRUONG], null, 1, 2),
        {
          ...match([TRUONG, NGUYEN, HIEN, HUYNH]),
          shuttles: lines([S70.id, 1], [THANH_CONG.id, 0]),
        },
      ],
    });

    expect(matchFormErrorList(errors)).toEqual([
      { field: "match-0-team-1", message: "Chọn đủ 2 người cho Cặp B" },
      { field: "match-1-team-1", message: "Chọn người cho Bên B" },
      { field: "match-1-shuttle-0", message: MATCH_FORM_MESSAGES.noShuttle },
      {
        field: "match-2-quantity-1",
        message: MATCH_FORM_MESSAGES.zeroQuantity,
      },
    ]);
  });

  it("một loại cầu chọn hai dòng trong trận, trận không còn dòng cầu", () => {
    const errors = validateMatchForm({
      court_total: 55000,
      matches: [
        {
          ...match([TRUONG, NGUYEN, HIEN, HUYNH]),
          shuttles: lines([S70.id, 1], [S70.id, 2]),
        },
        { ...match([TRUONG, NGUYEN, HIEN, HUYNH]), shuttles: [] },
      ],
    });

    expect(matchFormErrorList(errors)).toEqual([
      {
        field: "match-0-shuttle-1",
        message: MATCH_FORM_MESSAGES.duplicateShuttle,
      },
      {
        field: "match-1-add-shuttle",
        message: MATCH_FORM_MESSAGES.noShuttleLines,
      },
    ]);
  });

  it("chưa có trận nào", () => {
    expect(
      matchFormErrorList(validateMatchForm({ court_total: 0, matches: [] })),
    ).toEqual([{ field: "matches", message: MATCH_FORM_MESSAGES.noMatches }]);
  });

  it("chưa nhập tiền sân: lỗi ở ô tiền sân trước; gõ 0 vẫn hợp lệ", () => {
    const matches = [match([TRUONG, NGUYEN, HIEN, HUYNH])];
    expect(
      matchFormErrorList(validateMatchForm({ court_total: null, matches })),
    ).toEqual([{ field: "court", message: MATCH_FORM_MESSAGES.noCourt }]);
    expect(MATCH_FORM_MESSAGES.noCourt).toBe("Vui lòng nhập tổng tiền sân");
    expect(
      matchFormErrorList(validateMatchForm({ court_total: 0, matches })),
    ).toEqual([]);
  });

  it("đủ người, có cầu thì không lỗi", () => {
    const errors = validateMatchForm({
      court_total: 55000,
      matches: [
        match([TRUONG, NGUYEN, HIEN, HUYNH]),
        match([LOC, TAN], S70.id, 1, 2),
      ],
    });
    expect(matchFormErrorList(errors)).toEqual([]);
  });
});

describe("matchBillPayload", () => {
  it("gửi split_mode match và từng trận kèm các loại cầu, bỏ size và key", () => {
    expect(
      matchBillPayload({
        date: "2026-11-08",
        note: "",
        court_total: 55000,
        matches: [
          {
            key: 7,
            ...match([TRUONG, NGUYEN], S70.id, "2", 2),
            shuttles: lines([S70.id, "2"], [THANH_CONG.id, 1]),
          },
        ],
      }),
    ).toEqual({
      date: "2026-11-08",
      note: null,
      court_total: 55000,
      split_mode: "match",
      matches: [
        {
          player_ids: [TRUONG, NGUYEN],
          shuttles: [
            { shuttle_type_id: S70.id, quantity: 2 },
            { shuttle_type_id: THANH_CONG.id, quantity: 1 },
          ],
        },
      ],
    });
  });
});

describe("matchBillPayload player_ids", () => {
  it("Cặp A trước, Cặp B sau", () => {
    const payload = matchBillPayload({
      date: "2026-11-08",
      court_total: 0,
      matches: [
        {
          size: 4,
          teams: [
            [HIEN, LOC],
            [TRUONG, NGUYEN],
          ],
          shuttles: lines([S70.id, 1]),
        },
      ],
    });
    expect(payload.matches[0].player_ids).toEqual([HIEN, LOC, TRUONG, NGUYEN]);
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
          shuttles: [{ shuttle_type_id: S70.id, quantity: 1 }],
          players: [
            { id: TRUONG, pivot: { side: 1 } },
            { id: HIEN, pivot: { side: 2 } },
            { id: NGUYEN, pivot: { side: 1 } },
            { id: HUYNH, pivot: { side: 2 } },
          ],
        },
        {
          shuttles: [{ shuttle_type_id: S70.id, quantity: 1 }],
          players: [
            { id: LOC, pivot: { side: 1 } },
            { id: TAN, pivot: { side: 2 } },
          ],
        },
      ],
    });
    expect(form).toEqual({
      date: "2026-11-08",
      note: "Sau 9h",
      court_total: 55000,
      matches: [
        match([TRUONG, NGUYEN, HIEN, HUYNH], S70.id, 1),
        match([LOC, TAN], S70.id, 1, 2),
      ],
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
  it("dòng từng trận từ bill của API: tên người theo cặp, cầu, tiền mỗi người", () => {
    const lines = matchDisplayLines({
      court_total: 55000,
      matches: [
        {
          id: 1,
          position: 1,
          subtotal: 26000,
          shuttles: [{ quantity: 1, shuttle_type: { name: "Cầu S70" } }],
          players: [
            { id: TRUONG, name: "Trường", pivot: { side: 1 } },
            { id: NGUYEN, name: "Nguyên", pivot: { side: 1 } },
            { id: HIEN, name: "Hiển", pivot: { side: 2 } },
            { id: HUYNH, name: "Huỳnh", pivot: { side: 2 } },
          ],
        },
        {
          id: 2,
          position: 2,
          subtotal: 54000,
          shuttles: [
            { quantity: 1, shuttle_type: { name: "Cầu S70" } },
            { quantity: 1, shuttle_type: { name: "Cầu Thành Công" } },
          ],
          players: [
            { id: TRUONG, name: "Trường", pivot: { side: 1 } },
            { id: LOC, name: "Lộc", pivot: { side: 2 } },
          ],
        },
      ],
    });

    expect(lines).toEqual([
      {
        id: 1,
        position: 1,
        kind: "Đôi",
        teams: [
          ["Trường", "Nguyên"],
          ["Hiển", "Huỳnh"],
        ],
        shuttle_text: "Cầu S70 × 1",
        subtotal: 26000,
        per_player: 13375,
      },
      {
        id: 2,
        position: 2,
        kind: "Đơn",
        teams: [["Trường"], ["Lộc"]],
        shuttle_text: "Cầu S70 × 1 + Cầu Thành Công × 1",
        subtotal: 54000,
        per_player: 40750,
      },
    ]);
  });
});
