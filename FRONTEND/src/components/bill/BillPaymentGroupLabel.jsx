import { Check } from "../ui/icons";

const GROUPS = {
  unpaid: {
    label: "Chưa thanh toán",
    text: "text-rose-700",
    count: "bg-rose-100 text-rose-700",
  },
  paid: {
    label: "Đã thanh toán",
    text: "text-emerald-700",
    count: "bg-emerald-100 text-emerald-800",
  },
};

/**
 * Nhãn đầu nhóm ở danh sách người chơi của chi tiết bill (điện thoại và web): vòng rỗng
 * "Chưa thanh toán" màu hồng / dấu ✓ "Đã thanh toán" màu xanh lá, kèm số người.
 * Chỉ là nội dung nhãn — chỗ dùng tự bọc trong thẻ tiêu đề hoặc ô bảng.
 */
export default function BillPaymentGroupLabel({ paid = false, count }) {
  const group = paid ? GROUPS.paid : GROUPS.unpaid;
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${group.text}`}
    >
      {paid ? (
        <Check className="h-4 w-4" strokeWidth={2.5} />
      ) : (
        <span
          className="h-3.5 w-3.5 rounded-full border-2 border-current"
          aria-hidden="true"
        />
      )}
      {group.label}
      <span
        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${group.count}`}
      >
        {count}
      </span>
    </span>
  );
}
