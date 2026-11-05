import Modal from "../../components/ui/Modal";
import { ChartLine, Clock, Pencil, Trash2 } from "../../components/ui/icons";

/**
 * Sheet thao tác phụ của một loại cầu trên điện thoại (nút ⋯ trên thẻ): thẻ chỉ giữ
 * "Nhập kho", còn Lịch sử / Lên giá / Sửa / Xóa nằm ở đây. Điều kiện quyền giữ như các nút
 * cũ trên thẻ: shuttles.update cho ba mục đầu, shuttles.delete cho Xóa.
 *
 * Bấm một mục: đóng sheet rồi gọi hàm của mục đó với loại cầu đang mở.
 */
export default function ShuttleActionsSheet({
  shuttle,
  onClose,
  canUpdate,
  canDelete,
  onHistory,
  onPrice,
  onEdit,
  onDelete,
}) {
  const items = [
    canUpdate && { label: "Lịch sử", icon: Clock, run: onHistory },
    canUpdate && { label: "Lên giá", icon: ChartLine, run: onPrice },
    canUpdate && { label: "Sửa", icon: Pencil, run: onEdit },
    canDelete && { label: "Xóa", icon: Trash2, run: onDelete, danger: true },
  ].filter(Boolean);

  return (
    <Modal
      isOpen={Boolean(shuttle)}
      onClose={onClose}
      title={shuttle?.name ?? ""}
      size="sm"
      initialFocus="panel"
    >
      <div className="flex flex-col gap-0.5">
        {items.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                const target = shuttle;
                onClose();
                item.run(target);
              }}
              className={item.danger ? "menu-row menu-row-danger" : "menu-row"}
            >
              <span className="menu-row-icon">
                <IconComponent />
              </span>
              {item.label}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
