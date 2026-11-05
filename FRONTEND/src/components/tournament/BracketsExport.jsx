import {
  bracketExportSummary,
  genderLabel,
  orderBracketPlayers,
} from "../../utils/tournamentBrackets";

/** Biểu tượng app (public/favicon.svg) vẽ thẳng bằng SVG để ảnh xuất không phải đợi tải ảnh. */
function AppMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      width="36"
      height="36"
      aria-hidden="true"
      className="flex-none"
    >
      <rect width="64" height="64" rx="14" fill="#047857" />
      <path
        d="M25 42 L14 12 L50 12 L39 42 Z"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path
        d="M32 12 L32 42 M23 12 L28.5 42 M41 12 L35.5 42 M17.3 21 L46.7 21"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M24 41 L40 41 L40 46 A8 8 0 0 1 24 46 Z" fill="#fff" />
    </svg>
  );
}

/**
 * Khung ảnh "Xuất bảng" (quyết định 15): rộng cố định 720 px, 2 cột, có tên danh sách và ngày
 * xuất — ảnh giống nhau dù bấm từ điện thoại hay máy tính. Màn Xếp bảng đặt khung này ngoài
 * màn hình rồi chụp bằng nodeToPng (utils/exportImage.js); không hiện trên giao diện.
 *
 * brackets: đã sắp theo thứ tự hiển thị (sortBrackets); exportDate: chuỗi dd/mm/yyyy.
 */
export default function BracketsExport({ listName, brackets, exportDate }) {
  const { playerCount, bracketCount, distributionLabel } =
    bracketExportSummary(brackets);

  return (
    <div className="w-[720px] rounded-2xl border border-slate-200 bg-white p-7 text-slate-900">
      <div className="flex items-start gap-4">
        <AppMark />
        <div className="min-w-0 flex-1">
          <div className="break-words text-2xl font-semibold leading-8 tracking-tight">
            {listName}
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Bảng thi đấu · {exportDate}
          </div>
        </div>
        <div className="flex-none text-right text-sm leading-6 text-slate-600">
          <div>
            {playerCount} VĐV · {bracketCount} bảng
          </div>
          {distributionLabel && <div>{distributionLabel}</div>}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {brackets.map((bracket) => (
          <div
            key={bracket.id}
            className="rounded-xl border border-slate-200 px-4 pb-2 pt-3"
          >
            <div className="flex items-baseline justify-between gap-3 pb-2">
              <span className="break-words text-lg font-semibold">
                {bracket.name}
              </span>
              <span className="flex-none text-sm text-slate-500">
                {bracket.players.length} VĐV
              </span>
            </div>
            {orderBracketPlayers(bracket.players).map((player) => (
              <div
                key={player.id}
                className="grid grid-cols-[minmax(0,1fr)_2.5rem_4rem] gap-x-3 border-t border-slate-100 py-2 text-[15px] leading-5"
              >
                <span className="break-words">{player.name}</span>
                <span className="text-slate-500">
                  {genderLabel(player.gender)}
                </span>
                <span className="whitespace-nowrap text-right text-slate-500">
                  Level {player.level || "-"}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-4 text-[13px] text-slate-400">Sổ cầu lông</div>
    </div>
  );
}
