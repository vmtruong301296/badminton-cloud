import { formatDate, shuttleUnitPrice } from "./formatters";

/**
 * Bill con chia theo trận (split_mode = "match"). Hàm thuần, cùng công thức với
 * BACKEND/app/Services/MatchBillCalculator.php:
 * - tiền sân chia đều cho số trận, phần sân của trận chia cho người đánh trận đó;
 * - tiền cầu của trận chia cho người đánh trận đó;
 * - mỗi người trả tổng phần các trận mình đánh (màn hình làm tròn nghìn khi hiện).
 *
 * Một trận trong form: { key, size: 4 | 2, player_ids: number[], shuttle_type_id, quantity }.
 */

export const SPLIT_MATCH = "match";

/** Số người một trận: đôi (mặc định) / đơn. */
export const MATCH_SIZES = [
  { size: 4, label: "Đôi" },
  { size: 2, label: "Đơn" },
];

const DEFAULT_MATCH_SHUTTLE_NAME = "Cầu S70";

export const MATCH_FORM_MESSAGES = {
  noMatches: "Cần ít nhất một trận",
  players: (size) => `Chọn đủ ${size} người cho trận này`,
  noShuttle: "Chọn loại cầu",
  zeroQuantity: "Số lượng cầu phải lớn hơn 0",
};

/** Loại cầu điền sẵn cho trận mới: Cầu S70, không có thì loại đầu tiên. */
export const defaultMatchShuttleTypeId = (shuttleTypes = []) =>
  (
    shuttleTypes.find((t) => t.name === DEFAULT_MATCH_SHUTTLE_NAME) ??
    shuttleTypes[0]
  )?.id ?? null;

/** Trận mới: đánh đôi, chưa chọn người, 1 quả cầu mặc định. */
export const newMatch = (key, shuttleTypeId = null) => ({
  key,
  size: 4,
  player_ids: [],
  shuttle_type_id: shuttleTypeId,
  quantity: 1,
});

/** Chọn / bỏ một người: bấm lại thì bỏ; trận đủ người thì không chọn thêm. */
export const toggleMatchPlayer = (match, userId) => {
  if (match.player_ids.includes(userId)) {
    return {
      ...match,
      player_ids: match.player_ids.filter((id) => id !== userId),
    };
  }
  if (match.player_ids.length >= match.size) return match;
  return { ...match, player_ids: [...match.player_ids, userId] };
};

/** Đổi đôi / đơn: giữ những người chọn trước, bỏ người thừa. */
export const setMatchSize = (match, size) => ({
  ...match,
  size,
  player_ids: match.player_ids.slice(0, size),
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
    const type = shuttleTypes.find((t) => t.id === match.shuttle_type_id);
    const subtotal = shuttleUnitPrice(type) * (Number(match.quantity) || 0);
    const courtShare = courtPerMatch / match.size;
    const shuttleShare = subtotal / match.size;
    match.player_ids.forEach((userId) => {
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

/**
 * Lỗi theo ô: { noMatches?, matches: { [chỉ số trận]: { players?, shuttle?, quantity? } } }.
 */
export const validateMatchForm = ({ matches = [] } = {}) => {
  const errors = { matches: {} };
  if (matches.length === 0) errors.noMatches = MATCH_FORM_MESSAGES.noMatches;

  matches.forEach((match, index) => {
    const matchErrors = {};
    if (match.player_ids.length !== match.size) {
      matchErrors.players = MATCH_FORM_MESSAGES.players(match.size);
    }
    if (!match.shuttle_type_id) {
      matchErrors.shuttle = MATCH_FORM_MESSAGES.noShuttle;
    } else if (!(Number(match.quantity) > 0)) {
      matchErrors.quantity = MATCH_FORM_MESSAGES.zeroQuantity;
    }
    if (Object.keys(matchErrors).length > 0)
      errors.matches[index] = matchErrors;
  });

  return errors;
};

/** Lỗi theo thứ tự trên màn để cuộn tới ô sai đầu tiên; `field` khớp data-field của ô. */
export const matchFormErrorList = (errors = {}) => {
  const list = [];
  if (errors.noMatches)
    list.push({ field: "matches", message: errors.noMatches });
  Object.keys(errors.matches || {})
    .map(Number)
    .sort((a, b) => a - b)
    .forEach((index) => {
      ["players", "shuttle", "quantity"].forEach((part) => {
        const message = errors.matches[index][part];
        if (message) list.push({ field: `match-${index}-${part}`, message });
      });
    });
  return list;
};

/** Dữ liệu gửi máy chủ (POST / PUT /bills). */
export const matchBillPayload = ({ date, note, court_total, matches }) => ({
  date,
  note: note || null,
  court_total: Number(court_total) || 0,
  split_mode: SPLIT_MATCH,
  matches: matches.map((match) => ({
    player_ids: match.player_ids,
    shuttle_type_id: match.shuttle_type_id,
    quantity: Number(match.quantity) || 0,
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

/** Bill chia theo trận của API (kèm matches.players) → dữ liệu form (chưa có key). */
export const matchFormFromBill = (bill) => ({
  date: formatDate(bill.date),
  note: bill.note || "",
  court_total: Number(bill.court_total) || 0,
  matches: (bill.matches || []).map((m) => {
    const playerIds = (m.players || []).map((u) => u.id);
    return {
      size: playerIds.length === 2 ? 2 : 4,
      player_ids: playerIds,
      shuttle_type_id: m.shuttle_type_id,
      quantity: m.quantity,
    };
  }),
});

export const isMatchSplit = (bill) => bill?.split_mode === SPLIT_MATCH;

/** Nhãn cột ratio_value: bill chia theo trận lưu số trận mỗi người đánh. */
export const playerWeightLabel = (bill) =>
  isMatchSplit(bill) ? "Số trận" : "Mức tính";

/**
 * Dòng hiển thị từng trận của bill chia theo trận (API, kèm matches.players và
 * matches.shuttle_type): người đánh, cầu, tiền mỗi người của trận (làm tròn đồng).
 */
export const matchDisplayLines = (bill) => {
  const matches = bill?.matches || [];
  const courtPerMatch =
    matches.length > 0 ? (Number(bill.court_total) || 0) / matches.length : 0;

  return matches.map((m) => {
    const names = (m.players || []).map((u) => u.name);
    const playerCount = names.length || 1;
    const subtotal = Number(m.subtotal) || 0;
    return {
      id: m.id,
      position: m.position,
      kind: (
        MATCH_SIZES.find((option) => option.size === names.length) ??
        MATCH_SIZES[0]
      ).label,
      names,
      shuttle_name: m.shuttle_type?.name ?? "",
      quantity: m.quantity,
      subtotal,
      per_player: Math.round((courtPerMatch + subtotal) / playerCount),
    };
  });
};
