import { Check, ChevronDown, Loader } from "../ui/icons";

const TAG_TONES = {
  amber: "bg-amber-100 text-amber-800",
  sky: "bg-sky-100 text-sky-700",
  slate: "bg-slate-100 text-slate-600",
};

/** Chip nhỏ trên dòng phụ của hàng ("Nợ cũ", "2 bill", "Chi phí thêm"). */
export function BillPlayerTag({ tone = "slate", children }) {
  return (
    <span
      className={`inline-flex h-5 items-center whitespace-nowrap rounded-full px-1.5 text-xs font-semibold ${TAG_TONES[tone] || TAG_TONES.slate}`}
    >
      {children}
    </span>
  );
}

function PaidRing({ className = "border-slate-400" }) {
  return (
    <span
      className={`h-4 w-4 flex-none rounded-full border-2 ${className}`}
      aria-hidden="true"
    />
  );
}

/** Nút "Đã TT" 84 × 44 ở mép phải (M3b): bấm để đánh dấu / bỏ đánh dấu, có vòng quay khi đang lưu. */
function PaidButton({ name, paid, saving, onClick }) {
  const tone = saving
    ? "border border-emerald-300 bg-emerald-50 text-emerald-800 disabled:cursor-wait disabled:opacity-100"
    : paid
      ? "btn-primary"
      : "btn-secondary";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={saving}
      aria-pressed={paid}
      aria-busy={saving || undefined}
      aria-label={`Đã TT: ${name}`}
      className={`btn list-row-action gap-1.5 rounded-full px-3 ${tone}`}
    >
      {saving ? (
        <Loader className="h-4 w-4 animate-spin" />
      ) : paid ? (
        <Check className="h-4 w-4" strokeWidth={2.5} />
      ) : (
        <PaidRing />
      )}
      Đã TT
    </button>
  );
}

/** Thiếu quyền đánh dấu: chỉ hiện trạng thái, không bấm được. */
function PaidStatus({ paid }) {
  return (
    <span
      className={`inline-flex h-9 flex-none items-center gap-1.5 rounded-full border px-3 text-xs font-medium ${
        paid
          ? "border-emerald-300 bg-emerald-100 text-emerald-800"
          : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      {paid ? (
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      ) : (
        <PaidRing className="h-3.5 w-3.5 border-slate-300" />
      )}
      {paid ? "Đã TT" : "Chưa TT"}
    </span>
  );
}

/**
 * Hàng người chơi có nút "Đã TT" ở mép phải (M3b) và chi tiết mở tại chỗ (M3c), dùng cho
 * chi tiết bill cầu và bill tiệc. Render một <li> — đặt trong <ul className="list-card">.
 *
 * - index: STT (tùy chọn) — số thứ tự trong cả danh sách, khớp cột TT của ảnh xuất.
 * - name, meta (mảng node dòng phụ: mức tính / giờ TT / BillPlayerTag; mục falsy bị bỏ), amount (chuỗi đã in qua
 *   formatters.js), amountNote (dòng nhỏ dưới số tiền, vd "TT + Bill sau").
 * - paid, saving: trạng thái nút; onTogglePaid() — không truyền thì chỉ hiện nhãn "Đã TT" / "Chưa TT".
 * - highlight: nền sky + vạch trái (người nhiều bill).
 * - expanded, onToggleExpand, panelId, children: chạm phần trái của hàng để mở / đóng children
 *   (màn tự giữ mỗi lúc một hàng mở).
 */
export default function BillPlayerRow({
  index,
  name,
  meta,
  amount,
  amountNote,
  paid = false,
  saving = false,
  onTogglePaid,
  highlight = false,
  expanded = false,
  onToggleExpand,
  panelId,
  children,
}) {
  const metaItems = (Array.isArray(meta) ? meta : [meta]).filter(Boolean);
  const tone = highlight
    ? `bg-sky-50 ${paid ? "shadow-[inset_4px_0_0_theme(colors.emerald.500)]" : "shadow-[inset_4px_0_0_theme(colors.rose.400)]"}`
    : paid
      ? "bg-slate-50"
      : "";

  return (
    <li className={tone}>
      <div className="list-row list-row-split">
        <button
          type="button"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="list-row-main gap-2 pl-3"
        >
          <div className="list-row-text">
            <div
              className={`break-words text-[15px] leading-5 [overflow-wrap:anywhere] ${
                paid
                  ? "font-medium text-slate-600"
                  : "font-semibold text-slate-900"
              }`}
            >
              {index != null && (
                <span className="mr-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-100 px-1.5 align-[1px] text-xs font-medium tabular-nums text-slate-600">
                  {index}
                </span>
              )}
              {name}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] leading-[18px] text-slate-500">
              {metaItems.slice(0, -1)}
              {/* Mục cuối đi cùng mũi tên để mũi tên không rơi xuống dòng một mình */}
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                {metaItems[metaItems.length - 1]}
                <ChevronDown
                  className={`h-4 w-4 flex-none text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </span>
            </div>
          </div>
          <div className="flex-none text-right">
            <div
              className={`whitespace-nowrap text-base leading-5 tracking-tight tabular-nums ${
                paid
                  ? "font-semibold text-slate-500"
                  : "font-bold text-slate-900"
              }`}
            >
              {amount}
            </div>
            {amountNote && (
              <div className="mt-0.5 whitespace-nowrap text-xs font-semibold text-sky-700">
                {amountNote}
              </div>
            )}
          </div>
        </button>
        {onTogglePaid ? (
          <PaidButton
            name={name}
            paid={paid}
            saving={saving}
            onClick={onTogglePaid}
          />
        ) : (
          <PaidStatus paid={paid} />
        )}
      </div>
      {expanded && (
        <div id={panelId} className="space-y-2 pb-3 pl-3 pr-2.5">
          {children}
        </div>
      )}
    </li>
  );
}
