import { Check } from "../ui/icons";

const GROUPS = {
  unpaid: {
    label: "Chưa thanh toán",
    text: "text-rose-700",
    count: "bg-rose-100 text-rose-700",
    frame: "border-rose-200",
    band: "border-rose-200 bg-rose-50",
  },
  paid: {
    label: "Đã thanh toán",
    text: "text-emerald-700",
    count: "bg-emerald-100 text-emerald-800",
    frame: "border-emerald-200",
    band: "border-emerald-200 bg-emerald-50",
  },
};

/**
 * Nhãn đầu nhóm ở danh sách người chơi của chi tiết bill: vòng rỗng "Chưa thanh toán" màu hồng /
 * dấu ✓ "Đã thanh toán" màu xanh lá, kèm số người. Chỉ là nội dung nhãn — chỗ dùng tự bọc thẻ tiêu đề.
 */
export function BillPaymentGroupLabel({ paid = false, count }) {
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

/**
 * Khối một nhóm trên web (bảng desktop và BillContent): viền màu theo nhóm, dải tiêu đề tô màu,
 * rồi nội dung. Hai khối đặt cách nhau để không nhìn nhầm người đã trả với người chưa trả.
 * - as: thẻ tiêu đề của dải (theo cấp tiêu đề nơi dùng), mặc định "h3".
 */
export default function BillPaymentGroup({
  paid = false,
  count,
  as = "h3",
  children,
}) {
  const Heading = as;
  const group = paid ? GROUPS.paid : GROUPS.unpaid;
  return (
    <section
      className={`overflow-hidden rounded-xl border bg-white ${group.frame}`}
    >
      <Heading className={`border-b px-4 py-2.5 ${group.band}`}>
        <BillPaymentGroupLabel paid={paid} count={count} />
      </Heading>
      {children}
    </section>
  );
}
