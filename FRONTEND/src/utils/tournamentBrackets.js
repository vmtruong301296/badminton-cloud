/**
 * Hàm thuần cho màn Xếp bảng (screens/tournament/TournamentBrackets.jsx): thứ tự bảng, thứ tự
 * VĐV trong bảng và dòng tóm tắt của ảnh "Xuất bảng". Không gọi API, không sửa mảng truyền vào.
 */

/** Chữ hiển thị của kiểu phân bổ giới tính (gender_distribution của API). */
export const GENDER_DISTRIBUTION_LABELS = {
  mixed: "Chia đều giới tính",
  male_only: "Chỉ nam",
  female_only: "Chỉ nữ",
};

// Thứ tự hiển thị bảng: chỉ nam, chỉ nữ, chia đều; kiểu lạ xuống cuối.
const BRACKET_ORDER = { male_only: 0, female_only: 1, mixed: 2 };
const UNKNOWN_ORDER = 3;

// Thứ tự VĐV trong một bảng: nam trước nữ.
const GENDER_ORDER = { male: 0, female: 1 };

export const genderLabel = (gender) => (gender === "male" ? "Nam" : "Nữ");

export const sortBrackets = (brackets) =>
  [...brackets].sort(
    (a, b) =>
      (BRACKET_ORDER[a.gender_distribution] ?? UNKNOWN_ORDER) -
      (BRACKET_ORDER[b.gender_distribution] ?? UNKNOWN_ORDER),
  );

export const orderBracketPlayers = (players = []) =>
  [...players].sort(
    (a, b) =>
      (GENDER_ORDER[a.gender] ?? UNKNOWN_ORDER) -
      (GENDER_ORDER[b.gender] ?? UNKNOWN_ORDER),
  );

/** Góc phải ảnh xuất: số VĐV đã vào bảng, số bảng, các kiểu phân bổ (theo thứ tự hiển thị). */
export function bracketExportSummary(brackets) {
  const sorted = sortBrackets(brackets);
  const labels = [
    ...new Set(
      sorted
        .map(
          (bracket) => GENDER_DISTRIBUTION_LABELS[bracket.gender_distribution],
        )
        .filter(Boolean),
    ),
  ];

  return {
    playerCount: sorted.reduce(
      (sum, bracket) => sum + (bracket.players?.length ?? 0),
      0,
    ),
    bracketCount: sorted.length,
    distributionLabel: labels.join(" · "),
  };
}

/** Tên bảng (API) của VĐV đã xếp, null khi chưa xếp. */
export const playerBracketName = (player) => player.brackets?.[0]?.name ?? null;
