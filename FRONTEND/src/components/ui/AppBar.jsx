import { useContext, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import AppBarContext from "./appBarContext";
import Modal from "./Modal";
import { ChevronLeft, Ellipsis } from "./icons";

/** Nút quay lại 44 px của thanh trên; aria-label là nhãn quay lại cũ ("Danh sách bills"…). */
export function AppBarBackLink({ back }) {
  return (
    <Link to={back.to} aria-label={back.label} className="app-bar-btn">
      <ChevronLeft className="h-6 w-6" />
    </Link>
  );
}

function MenuItem({ item, onDone }) {
  const IconComponent = item.icon;
  const className = `menu-row ${item.danger ? "menu-row-danger" : ""}`;
  const content = (
    <>
      {IconComponent && (
        <span className="menu-row-icon">
          <IconComponent />
        </span>
      )}
      {item.label}
    </>
  );

  if (item.to) {
    return (
      <Link to={item.to} onClick={onDone} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={() => {
        onDone();
        item.onClick?.();
      }}
      className={className}
    >
      {content}
    </button>
  );
}

/**
 * Nội dung thanh trên điện thoại (M1) của một màn, đưa vào khe của Layout.
 * Thường không gọi trực tiếp: PageHeader tự dùng. Gọi trực tiếp khi màn muốn
 * tiêu đề trên thanh mà không cần khối PageHeader trong nội dung (nhớ tự hiện
 * tiêu đề cho desktop, vì thanh này chỉ có dưới sm).
 *
 * - title: chữ / node một dòng (cắt "…").
 * - back: { to, label } → màn đẩy vào: nút ‹ thay biểu tượng app, ẩn vòng tài khoản và tab.
 * - menu: [{ label, icon, onClick | to, danger, disabled }] → nút ⋯ mở sheet thao tác phụ.
 *   Mảng rỗng / không truyền thì không có ⋯. Thao tác xóa (danger) vẫn phải qua ConfirmDialog.
 * - menuTitle: tiêu đề sheet ⋯ (mặc định = title).
 * - action: một nút 44 px bên phải (class app-bar-btn, nhớ aria-label), cho màn gốc.
 * - hideTabBar: ẩn tab dưới đáy dù đường dẫn không nằm trong danh sách màn đẩy vào.
 */
export default function AppBar({
  title,
  back,
  menu,
  menuTitle,
  action,
  hideTabBar = false,
}) {
  const bar = useContext(AppBarContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const register = bar?.register;
  const pushed = Boolean(back);

  useLayoutEffect(() => {
    if (!register) return undefined;
    return register({ pushed, hideTabBar });
  }, [register, pushed, hideTabBar]);

  if (!bar?.slot) return null;

  const items = (menu || []).filter(Boolean);
  const closeMenu = () => setMenuOpen(false);

  return createPortal(
    <>
      {back && <AppBarBackLink back={back} />}
      <h1 className="app-bar-title">{title}</h1>
      {action}
      {items.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Thao tác khác"
            aria-haspopup="dialog"
            className="app-bar-btn"
          >
            <Ellipsis className="h-6 w-6" />
          </button>
          <Modal
            isOpen={menuOpen}
            onClose={closeMenu}
            title={menuTitle ?? title}
            size="sm"
            initialFocus="panel"
          >
            <div className="flex flex-col gap-0.5">
              {items.map((item) => (
                <MenuItem
                  key={item.key ?? item.label}
                  item={item}
                  onDone={closeMenu}
                />
              ))}
            </div>
          </Modal>
        </>
      )}
    </>,
    bar.slot,
  );
}
