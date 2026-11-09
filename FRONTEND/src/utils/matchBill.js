import { BILL_FORM_MESSAGES, isCourtBlank } from "./billFormErrors";
import { formatDate, shuttleUnitPrice } from "./formatters";

/**
 * Bill chia theo trận (split_mode = "match"), cả bill chính lẫn bill con. Hàm thuần, cùng
 * công thức với BACKEND/app/Services/MatchBillCalculator.php:
 * - tiền sân chia đều cho số trận, phần sân của trận chia cho người đánh trận đó;
 * - tiền cầu của trận chia cho người đánh trận đó;
 * - mỗi người trả tổng phần các trận mình đánh (màn hình làm tròn nghìn khi hiện).
 *
 * Một trận trong form: { key, size: 4 | 2, teams: [number[], number[]], shuttles: ShuttleLine[] }
 * — teams là Cặp A và Cặp B (đánh đơn: mỗi bên một người); mỗi dòng cầu
 * { key, shuttle_type_id, quantity } — một trận có thể dùng nhiều loại cầu.
 */

export const SPLIT_MATCH = "match";
export const SPLIT_RATIO = "ratio";

/** Số người một trận: đôi (mặc định) / đơn. */
export const MATCH_SIZES = [
  { size: 4, label: "Đôi" },
  { size: 2, label: "Đơn" },
];

/** bill_match_players.side của Cặp A, Cặp B (BillMatch::SIDE_A / SIDE_B). */
const MATCH_SIDES = [1, 2];

/** Tên hai bên của trận: đánh đôi là cặp, đánh đơn là bên. */
const TEAM_LABELS = {
  4: ["Cặp A", "Cặp B"],
  2: ["Bên A", "Bên B"],
};

const DEFAULT_MATCH_SHUTTLE_NAME = "Cầu S70";

export const MATCH_FORM_MESSAGES = {
  noCourt: BILL_FORM_MESSAGES.noCourt,
  noMatches: "Cần ít nhất một trận",
  team: (label, count) =>
    count === 1
      ? `Chọn người cho ${label}`
      : `Chọn đủ ${count} người cho ${label}`,
  noShuttleLines: "Thêm ít nhất một loại cầu",
  noShuttle: "Chọn loại cầu",
  duplicateShuttle: "Loại cầu này đã có trong trận",
  zeroQuantity: "Số lượng cầu phải lớn hơn 0",
  teamFull: (label, count) =>
    `${label} đã đủ ${count} người — bỏ bớt một người trước khi chọn thêm.`,
  movedTeam: (name, from, to) => `Đã chuyển ${name} từ ${from} sang ${to}.`,
  nextTeam: (done, next) => `Đã đủ ${done} — chọn tiếp ${next}.`,
};

/** Tên bên `team` (0 = A, 1 = B) của trận đôi / đơn. */
export const teamLabel = (size, team) =>
  (TEAM_LABELS[size] ?? TEAM_LABELS[4])[team];

/** Số người mỗi bên: đôi 2, đơn 1. */
export const teamCapacity = (match) => match.size / 2;

/** Mọi người đánh của trận: Cặp A rồi Cặp B. */
export const matchPlayerIds = (match) => match.teams.flat();

/** Loại cầu điền sẵn cho trận mới: Cầu S70, không có thì loại đầu tiên. */
export const defaultMatchShuttleTypeId = (shuttleTypes = []) =>
  (
    shuttleTypes.find((t) => t.name === DEFAULT_MATCH_SHUTTLE_NAME) ??
    shuttleTypes[0]
  )?.id ?? null;

/** Dòng cầu mới: 1 quả. */
const newShuttleLine = (key, shuttleTypeId = null) => ({
  key,
  shuttle_type_id: shuttleTypeId,
  quantity: 1,
});

/** Trận mới: đánh đôi, chưa chọn người, 1 quả cầu mặc định. */
export const newMatch = (key, shuttleTypeId = null) => ({
  key,
  size: 4,
  teams: [[], []],
  shuttles: [newShuttleLine(1, shuttleTypeId)],
});

/** Loại cầu điền sẵn cho dòng mới của trận: loại chưa có trong trận (ưu tiên Cầu S70). */
const unusedShuttleTypeId = (match, shuttleTypes, exceptKey = null) => {
  const used = new Set(
    match.shuttles
      .filter((line) => line.key !== exceptKey)
      .map((line) => line.shuttle_type_id),
  );
  return defaultMatchShuttleTypeId(shuttleTypes.filter((t) => !used.has(t.id)));
};

/** Thêm một loại cầu vào trận; hết loại chưa dùng thì giữ nguyên trận. */
export const addMatchShuttle = (match, shuttleTypes = []) => {
  const typeId = unusedShuttleTypeId(match, shuttleTypes);
  if (!typeId) return match;
  const key = Math.max(0, ...match.shuttles.map((line) => line.key)) + 1;
  return {
    ...match,
    shuttles: [...match.shuttles, newShuttleLine(key, typeId)],
  };
};

const hasEmptyShuttleLine = (match) =>
  match.shuttles.some((line) => !line.shuttle_type_id);

const fillMatchShuttleTypes = (match, shuttleTypes) =>
  match.shuttles.reduce((current, line) => {
    if (line.shuttle_type_id) return current;
    const typeId = unusedShuttleTypeId(current, shuttleTypes, line.key);
    return {
      ...current,
      shuttles: current.shuttles.map((l) =>
        l.key === line.key ? { ...l, shuttle_type_id: typeId } : l,
      ),
    };
  }, match);

/**
 * Dòng cầu chưa có loại (vd trận đầu khi loại cầu chưa tải xong) nhận loại mặc định chưa dùng
 * trong trận. Không có dòng trống thì trả lại đúng mảng cũ.
 */
export const fillDefaultShuttleTypes = (matches, shuttleTypes = []) =>
  matches.some(hasEmptyShuttleLine)
    ? matches.map((match) =>
        hasEmptyShuttleLine(match)
          ? fillMatchShuttleTypes(match, shuttleTypes)
          : match,
      )
    : matches;

/** Tiền cầu của trận: cộng các dòng cầu theo giá loại cầu. */
export const matchShuttleSubtotal = (match, shuttleTypes = []) =>
  match.shuttles.reduce((sum, line) => {
    const type = shuttleTypes.find((t) => t.id === line.shuttle_type_id);
    return sum + shuttleUnitPrice(type) * (Number(line.quantity) || 0);
  }, 0);

/**
 * Chọn / bỏ một người ở bên `team`: bấm lại thì bỏ; bên đủ người thì không chọn thêm; người
 * đang ở bên kia thì chuyển sang bên này.
 */
export const toggleTeamPlayer = (match, team, userId) => {
  const current = match.teams[team];
  if (current.includes(userId)) {
    return {
      ...match,
      teams: match.teams.map((ids, i) =>
        i === team ? ids.filter((id) => id !== userId) : ids,
      ),
    };
  }
  if (current.length >= teamCapacity(match)) return match;
  return {
    ...match,
    teams: match.teams.map((ids, i) =>
      i === team ? [...ids, userId] : ids.filter((id) => id !== userId),
    ),
  };
};

/**
 * Sheet chọn người sau khi vừa chọn một người vào bên `team` (trận đã cập nhật): bên đó còn
 * thiếu thì ở lại (trả `team`); đủ rồi thì sang bên kia nếu bên kia còn thiếu; cả hai đủ thì
 * đóng sheet (trả null).
 */
export const pickerTeamAfterPick = (match, team) => {
  const capacity = teamCapacity(match);
  if (match.teams[team].length < capacity) return team;
  const other = 1 - team;
  return match.teams[other].length < capacity ? other : null;
};

/** Đổi đôi / đơn: mỗi bên giữ những người chọn trước, bỏ người thừa. */
export const setMatchSize = (match, size) => ({
  ...match,
  size,
  teams: match.teams.map((ids) => ids.slice(0, size / 2)),
});

/**
 * Xem trước tiền. Trận chưa đủ người vẫn chia theo số người của trận (đôi 4, đơn 2) để số
 * tiền không nhảy khi chọn thêm người.
 *
 * @returns {{
 *   court_total: number, total_shuttle_price: number, total_amount: number,
 *   matches: { subtotal: number, court_share: number, shuttle_share: number, per_player: number }[],
 *   players: { user_id: number, match_count: number, share_amount: number }[],
 * }}
 */
export const calculateMatchPreview = (
  courtTotal,
  matches = [],
  shuttleTypes = [],
) => {
  const court = Number(courtTotal) || 0;
  const courtPerMatch = matches.length > 0 ? court / matches.length : 0;
  const raw = new Map();
  const counts = new Map();

  const matchLines = matches.map((match) => {
    const subtotal = matchShuttleSubtotal(match, shuttleTypes);
    const courtShare = courtPerMatch / match.size;
    const shuttleShare = subtotal / match.size;
    matchPlayerIds(match).forEach((userId) => {
      raw.set(userId, (raw.get(userId) || 0) + courtShare + shuttleShare);
      counts.set(userId, (counts.get(userId) || 0) + 1);
    });
    return {
      subtotal,
      court_share: courtShare,
      shuttle_share: shuttleShare,
      per_player: courtShare + shuttleShare,
    };
  });

  const totalShuttlePrice = matchLines.reduce((sum, m) => sum + m.subtotal, 0);

  return {
    court_total: court,
    total_shuttle_price: totalShuttlePrice,
    total_amount: court + totalShuttlePrice,
    matches: matchLines,
    players: [...raw].map(([userId, amount]) => ({
      user_id: userId,
      match_count: counts.get(userId),
      share_amount: Math.round(amount),
    })),
  };
};

/** Lỗi từng dòng cầu của trận: { [chỉ số dòng]: { shuttle?, quantity? } }. */
const validateShuttleLines = (shuttles) => {
  const lineErrors = {};
  const seen = new Set();
  shuttles.forEach((line, index) => {
    if (!line.shuttle_type_id) {
      lineErrors[index] = { shuttle: MATCH_FORM_MESSAGES.noShuttle };
    } else if (seen.has(line.shuttle_type_id)) {
      lineErrors[index] = { shuttle: MATCH_FORM_MESSAGES.duplicateShuttle };
    } else if (!(Number(line.quantity) > 0)) {
      lineErrors[index] = { quantity: MATCH_FORM_MESSAGES.zeroQuantity };
    }
    seen.add(line.shuttle_type_id);
  });
  return lineErrors;
};

/** Lỗi từng bên của trận chưa đủ người: { [0 | 1]: thông báo }. */
const validateTeams = (match) => {
  const teamErrors = {};
  const capacity = teamCapacity(match);
  match.teams.forEach((ids, team) => {
    if (ids.length !== capacity) {
      teamErrors[team] = MATCH_FORM_MESSAGES.team(
        teamLabel(match.size, team),
        capacity,
      );
    }
  });
  return teamErrors;
};

/**
 * Lỗi theo ô: { court?, noMatches?, matches: { [chỉ số trận]: { teams?: { [0 | 1]: string },
 * noShuttleLines?, lines?: { [chỉ số dòng cầu]: { shuttle?, quantity? } } } } }.
 */
export const validateMatchForm = ({ court_total, matches = [] } = {}) => {
  const errors = { matches: {} };
  if (isCourtBlank(court_total)) errors.court = MATCH_FORM_MESSAGES.noCourt;
  if (matches.length === 0) errors.noMatches = MATCH_FORM_MESSAGES.noMatches;

  matches.forEach((match, index) => {
    const matchErrors = {};
    const teamErrors = validateTeams(match);
    if (Object.keys(teamErrors).length > 0) matchErrors.teams = teamErrors;
    if (match.shuttles.length === 0) {
      matchErrors.noShuttleLines = MATCH_FORM_MESSAGES.noShuttleLines;
    }
    const lineErrors = validateShuttleLines(match.shuttles);
    if (Object.keys(lineErrors).length > 0) matchErrors.lines = lineErrors;
    if (Object.keys(matchErrors).length > 0)
      errors.matches[index] = matchErrors;
  });

  return errors;
};

/** Lỗi theo thứ tự trên màn để cuộn tới ô sai đầu tiên; `field` khớp data-field của ô. */
export const matchFormErrorList = (errors = {}) => {
  const list = [];
  if (errors.court) list.push({ field: "court", message: errors.court });
  if (errors.noMatches)
    list.push({ field: "matches", message: errors.noMatches });
  Object.keys(errors.matches || {})
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((index) => {
      const matchErrors = errors.matches[index];
      Object.keys(matchErrors.teams || {})
        .map(Number)
        .sort((a, b) => a - b)
        .forEach((team) => {
          list.push({
            field: `match-${index}-team-${team}`,
            message: matchErrors.teams[team],
          });
        });
      if (matchErrors.noShuttleLines) {
        list.push({
          field: `match-${index}-add-shuttle`,
          message: matchErrors.noShuttleLines,
        });
      }
      Object.keys(matchErrors.lines || {})
        .map(Number)
        .sort((a, b) => a - b)
        .forEach((line) => {
          ["shuttle", "quantity"].forEach((part) => {
            const message = matchErrors.lines[line][part];
            if (message)
              list.push({ field: `match-${index}-${part}-${line}`, message });
          });
        });
    });
  return list;
};

/** Dữ liệu gửi máy chủ (POST / PUT /bills); player_ids: Cặp A trước, Cặp B sau. */
export const matchBillPayload = ({ date, note, court_total, matches }) => ({
  date,
  note: note || null,
  court_total: Number(court_total) || 0,
  split_mode: SPLIT_MATCH,
  matches: matches.map((match) => ({
    player_ids: matchPlayerIds(match),
    shuttles: match.shuttles.map((line) => ({
      shuttle_type_id: line.shuttle_type_id,
      quantity: Number(line.quantity) || 0,
    })),
  })),
});

/**
 * Người chọn được cho các trận: người của bill chính (bill_players), rồi người đã có trong
 * trận mà không thuộc bill chính (khi sửa bill). Trả [{ user_id, name }].
 */
export const matchCandidates = (parentPlayers = [], matches = []) => {
  const seen = new Set();
  const list = [];
  const add = (userId, name) => {
    if (seen.has(userId)) return;
    seen.add(userId);
    list.push({ user_id: userId, name });
  };
  parentPlayers.forEach((p) => add(p.user_id, p.user?.name ?? p.name));
  matches.forEach((m) => (m.players || []).forEach((u) => add(u.id, u.name)));
  return list;
};

/** Người đánh của trận (API, kèm players.pivot.side) chia theo bên: [Cặp A, Cặp B]. */
const playersBySide = (match) =>
  MATCH_SIDES.map((side) =>
    (match.players || []).filter((u) => u.pivot?.side === side),
  );

/** Bill chia theo trận của API (kèm matches.players, matches.shuttles) → dữ liệu form (chưa có key trận). */
export const matchFormFromBill = (bill) => ({
  date: formatDate(bill.date),
  note: bill.note || "",
  court_total: Number(bill.court_total) || 0,
  matches: (bill.matches || []).map((m) => {
    const teams = playersBySide(m).map((users) => users.map((u) => u.id));
    return {
      size: (m.players || []).length === 2 ? 2 : 4,
      teams,
      shuttles: (m.shuttles || []).map((line, index) => ({
        key: index + 1,
        shuttle_type_id: line.shuttle_type_id,
        quantity: line.quantity,
      })),
    };
  }),
});

export const isMatchSplit = (bill) => bill?.split_mode === SPLIT_MATCH;

/** Nhãn cột ratio_value: bill chia theo trận lưu số trận mỗi người đánh. */
export const playerWeightLabel = (bill) =>
  isMatchSplit(bill) ? "Số trận" : "Mức tính";

/**
 * Dòng hiển thị từng trận của bill chia theo trận (API, kèm matches.players và
 * matches.shuttles.shuttle_type): tên người đánh theo bên (teams: [Cặp A, Cặp B]), cầu, tiền
 * mỗi người của trận (làm tròn đồng).
 */
export const matchDisplayLines = (bill) => {
  const matches = bill?.matches || [];
  const courtPerMatch =
    matches.length > 0 ? (Number(bill.court_total) || 0) / matches.length : 0;

  return matches.map((m) => {
    const playerCount = (m.players || []).length;
    const teams = playersBySide(m).map((users) => users.map((u) => u.name));
    const subtotal = Number(m.subtotal) || 0;
    return {
      id: m.id,
      position: m.position,
      kind: (
        MATCH_SIZES.find((option) => option.size === playerCount) ??
        MATCH_SIZES[0]
      ).label,
      teams,
      shuttle_text: (m.shuttles || [])
        .map((line) => `${line.shuttle_type?.name ?? ""} × ${line.quantity}`)
        .join(" + "),
      subtotal,
      per_player: Math.round((courtPerMatch + subtotal) / (playerCount || 1)),
    };
  });
};
